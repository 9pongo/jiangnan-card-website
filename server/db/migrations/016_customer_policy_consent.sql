ALTER TABLE customers ADD COLUMN terms_version text;
ALTER TABLE customers ADD COLUMN terms_accepted_at timestamptz;
ALTER TABLE customers ADD COLUMN privacy_version text;
ALTER TABLE customers ADD COLUMN privacy_accepted_at timestamptz;

CREATE INDEX customers_policy_acceptance_idx ON customers(terms_version, privacy_version);
