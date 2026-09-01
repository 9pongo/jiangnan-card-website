CREATE TYPE product_kind AS ENUM ('preorder', 'in_stock');
CREATE TYPE product_status AS ENUM ('draft', 'published', 'archived');
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL CHECK (sku ~ '^[A-Z0-9-]{3,48}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  kind product_kind NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  deposit_cents integer CHECK (deposit_cents >= 0 AND deposit_cents <= price_cents),
  available_stock integer CHECK (available_stock >= 0),
  release_date date,
  image_url text,
  status product_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='preorder' AND deposit_cents IS NOT NULL AND release_date IS NOT NULL AND available_stock IS NULL) OR (kind='in_stock' AND deposit_cents IS NULL AND available_stock IS NOT NULL))
);
CREATE INDEX products_public_listing ON products (status, kind, created_at DESC);
CREATE TRIGGER products_touch_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();
