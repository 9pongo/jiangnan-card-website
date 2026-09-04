#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

if [ "${MIGRATION_BASELINE:-}" = "016_customer_policy_consent.sql" ]; then
  if [ "${MIGRATION_BASELINE_ACK:-}" != "existing-schema-verified" ]; then
    echo "MIGRATION_BASELINE_ACK=existing-schema-verified is required for baseline." >&2
    exit 1
  fi
  empty=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT NOT EXISTS (SELECT 1 FROM schema_migrations)')
  compatible=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT to_regclass('public.orders') IS NOT NULL AND to_regclass('public.customers') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='privacy_accepted_at') AND EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid='order_status'::regtype AND enumlabel='expired')")
  if [ "$empty" != "t" ] || [ "$compatible" != "t" ]; then
    echo "Database is not an empty migration ledger with the expected 016 schema; refusing baseline." >&2
    exit 1
  fi
  echo "Baselining verified existing schema through 016_customer_policy_consent.sql"
  find /migrations -maxdepth 1 -type f -name '*.sql' | sort | while IFS= read -r migration; do
    filename=$(basename "$migration")
    [ "$filename" \> "016_customer_policy_consent.sql" ] && break
    checksum=$(sha256sum "$migration" | awk '{print $1}')
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations(filename, checksum_sha256) VALUES ('$filename', '$checksum')"
  done
fi

find /migrations -maxdepth 1 -type f -name '*.sql' | sort | while IFS= read -r migration; do
  filename=$(basename "$migration")
  checksum=$(sha256sum "$migration" | awk '{print $1}')
  case "$filename" in
    *[!0-9A-Za-z_.-]*) echo "Unexpected migration filename: $filename" >&2; exit 1 ;;
  esac
  applied=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT checksum_sha256 FROM schema_migrations WHERE filename = '$filename'")

  if [ -n "$applied" ]; then
    if [ "$applied" != "$checksum" ]; then
      echo "Migration checksum mismatch: $filename" >&2
      exit 1
    fi
    echo "Already applied: $filename"
    continue
  fi

  echo "Applying: $filename"
  runfile=$(mktemp)
  trap 'rm -f "$runfile"' EXIT HUP INT TERM
  printf '\\i %s\nINSERT INTO schema_migrations(filename, checksum_sha256) VALUES (\047%s\047, \047%s\047);\n' "$migration" "$filename" "$checksum" > "$runfile"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f "$runfile"
  rm -f "$runfile"
  trap - EXIT HUP INT TERM
done
