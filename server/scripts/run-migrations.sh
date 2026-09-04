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

find /migrations -maxdepth 1 -type f -name '*.sql' | sort | while IFS= read -r migration; do
  filename=$(basename "$migration")
  checksum=$(sha256sum "$migration" | awk '{print $1}')
  applied=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v filename="$filename" -Atqc "SELECT checksum_sha256 FROM schema_migrations WHERE filename = :'filename'")

  if [ -n "$applied" ]; then
    if [ "$applied" != "$checksum" ]; then
      echo "Migration checksum mismatch: $filename" >&2
      exit 1
    fi
    echo "Already applied: $filename"
    continue
  fi

  echo "Applying: $filename"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v filename="$filename" -v checksum="$checksum" -c "INSERT INTO schema_migrations(filename, checksum_sha256) VALUES (:'filename', :'checksum')"
done
