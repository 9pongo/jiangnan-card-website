CREATE TYPE product_change_status AS ENUM ('pending_review', 'approved', 'rejected', 'cancelled');

CREATE TABLE product_change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id),
  proposed_data jsonb NOT NULL,
  status product_change_status NOT NULL DEFAULT 'pending_review',
  created_by uuid NOT NULL REFERENCES users(id),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(proposed_data) = 'object')
);

CREATE UNIQUE INDEX product_change_proposals_one_open_per_product
  ON product_change_proposals(product_id)
  WHERE status = 'pending_review';

CREATE INDEX product_change_proposals_product_status_idx
  ON product_change_proposals(product_id, status, created_at DESC);
