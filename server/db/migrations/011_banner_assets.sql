CREATE TYPE banner_asset_status AS ENUM ('uploading', 'uploaded', 'rejected');

CREATE TABLE banner_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key text NOT NULL UNIQUE,
  public_url text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  status banner_asset_status NOT NULL DEFAULT 'uploading',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX banner_assets_creator_status_idx ON banner_assets(created_by, status, created_at DESC);
