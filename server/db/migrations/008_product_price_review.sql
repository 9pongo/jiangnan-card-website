ALTER TYPE product_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TABLE products ADD COLUMN original_price_cents integer CHECK (original_price_cents IS NULL OR original_price_cents >= price_cents);
