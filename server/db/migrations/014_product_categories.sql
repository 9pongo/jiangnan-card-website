ALTER TABLE products
  ADD COLUMN category text NOT NULL DEFAULT 'booster'
  CHECK (category IN ('booster', 'single_card', 'accessories', 'toy_model'));

CREATE INDEX products_public_category_listing
  ON products (status, kind, category, created_at DESC);
