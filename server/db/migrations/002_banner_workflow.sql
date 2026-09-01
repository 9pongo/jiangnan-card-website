CREATE TYPE banner_event_type AS ENUM ('impression', 'click');
CREATE TABLE banner_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  banner_id uuid NOT NULL REFERENCES banners(id),
  event_type banner_event_type NOT NULL,
  event_key uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type, event_key)
);
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_log is append-only'; END; $$;
CREATE TRIGGER audit_log_no_update_or_delete BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE INDEX banner_events_metrics ON banner_events (banner_id, event_type, occurred_at);
CREATE OR REPLACE FUNCTION touch_banner_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER banners_touch_updated_at BEFORE UPDATE ON banners FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();
CREATE OR REPLACE FUNCTION active_banner_for_placement(requested_placement banner_placement, at_time timestamptz) RETURNS TABLE(id uuid, name text, kind banner_kind, target_url text, image_url text) LANGUAGE sql STABLE AS $$
  SELECT b.id,b.name,b.kind,b.target_url,b.image_url FROM banners b
  WHERE b.placement=requested_placement AND b.status IN ('published','scheduled') AND b.starts_at <= at_time AND b.ends_at > at_time
  ORDER BY CASE WHEN b.kind='store' AND b.priority>=900 THEN 0 ELSE 1 END, b.priority DESC, b.created_at DESC LIMIT 1
$$;
