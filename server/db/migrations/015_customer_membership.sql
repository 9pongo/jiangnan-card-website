CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text NOT NULL,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
  postal_code text NOT NULL CHECK (postal_code ~ '^[0-9]{3,6}$'),
  address_city text NOT NULL CHECK (char_length(address_city) BETWEEN 1 AND 40),
  address_district text NOT NULL CHECK (char_length(address_district) BETWEEN 1 AND 40),
  address_line text NOT NULL CHECK (char_length(address_line) BETWEEN 1 AND 160),
  phone_e164 text,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((phone_e164 IS NULL AND phone_verified_at IS NULL) OR phone_e164 IS NOT NULL)
);

CREATE TABLE customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_sessions_active_idx ON customer_sessions(token_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE customer_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,
  email text,
  phone_e164 text,
  purpose text NOT NULL CHECK (purpose IN ('email_registration', 'password_reset', 'phone_payment')),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((email IS NOT NULL) <> (phone_e164 IS NOT NULL))
);
CREATE INDEX customer_challenge_lookup_idx ON customer_verification_challenges(purpose, email, phone_e164, expires_at DESC) WHERE consumed_at IS NULL;

CREATE TABLE customer_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER customers_touch_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();
CREATE OR REPLACE FUNCTION reject_customer_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'customer audit records are append-only'; END; $$;
CREATE TRIGGER customer_audit_log_no_update BEFORE UPDATE ON customer_audit_log FOR EACH ROW EXECUTE FUNCTION reject_customer_audit_mutation();
CREATE TRIGGER customer_audit_log_no_delete BEFORE DELETE ON customer_audit_log FOR EACH ROW EXECUTE FUNCTION reject_customer_audit_mutation();

ALTER TABLE orders ADD COLUMN customer_id uuid REFERENCES customers(id);
ALTER TABLE orders ADD COLUMN shipping_name text;
ALTER TABLE orders ADD COLUMN shipping_phone_e164 text;
ALTER TABLE orders ADD COLUMN shipping_postal_code text;
ALTER TABLE orders ADD COLUMN shipping_city text;
ALTER TABLE orders ADD COLUMN shipping_district text;
ALTER TABLE orders ADD COLUMN shipping_address_line text;
CREATE INDEX orders_customer_created_idx ON orders(customer_id, created_at DESC);
