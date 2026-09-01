CREATE TYPE consignment_case_status AS ENUM ('submitted','received','listed','sold','returned','cancelled');
CREATE TYPE card_item_status AS ENUM ('received','listed','sold','returned');
CREATE TABLE consignment_cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_number text UNIQUE NOT NULL, seller_name text NOT NULL, seller_contact text NOT NULL, status consignment_case_status NOT NULL DEFAULT 'submitted', created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE consignment_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES consignment_cases(id), card_name text NOT NULL, card_number text, card_condition text NOT NULL, suggested_price_cents integer NOT NULL CHECK (suggested_price_cents>=0), status card_item_status NOT NULL DEFAULT 'received', created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX consignment_cases_status ON consignment_cases(status,created_at DESC);
CREATE TRIGGER consignment_cases_touch_updated_at BEFORE UPDATE ON consignment_cases FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();
