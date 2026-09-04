CREATE TYPE order_status AS ENUM ('pending_payment','paid','cancelled','fulfilled');
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_number text UNIQUE NOT NULL, idempotency_key uuid UNIQUE NOT NULL, customer_email text NOT NULL, status order_status NOT NULL DEFAULT 'pending_payment', amount_due_cents integer NOT NULL CHECK(amount_due_cents>=0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id), product_id uuid NOT NULL REFERENCES products(id), quantity integer NOT NULL CHECK(quantity>0), product_name text NOT NULL, unit_price_cents integer NOT NULL, due_per_unit_cents integer NOT NULL);
CREATE INDEX orders_status_created ON orders(status,created_at DESC);
CREATE TRIGGER orders_touch_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();
