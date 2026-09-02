ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'expired';
ALTER TABLE orders ADD COLUMN expires_at timestamptz;
ALTER TABLE orders ADD COLUMN reservation_released_at timestamptz;
ALTER TABLE order_items ADD COLUMN reserved_stock boolean NOT NULL DEFAULT false;

UPDATE order_items oi
SET reserved_stock = true
FROM products p
WHERE p.id = oi.product_id AND p.kind = 'in_stock';

CREATE INDEX orders_expiry_pending_idx ON orders(expires_at) WHERE status = 'pending_payment';
