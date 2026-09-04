-- Provider-neutral payment records. Provider adapters may only advance these
-- records after verified callbacks or reconciliation; admin users never do so.
CREATE TYPE payment_attempt_status AS ENUM ('created','provider_pending','authorized','captured','failed','cancelled','refunded','reconciliation_required');

CREATE TABLE payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{2,32}$'),
  idempotency_key uuid NOT NULL UNIQUE,
  provider_transaction_id text UNIQUE,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'TWD' CHECK (currency = 'TWD'),
  status payment_attempt_status NOT NULL DEFAULT 'created',
  provider_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, idempotency_key)
);

CREATE INDEX payment_attempts_order_created_idx ON payment_attempts(order_id, created_at DESC);
CREATE INDEX payment_attempts_provider_transaction_idx ON payment_attempts(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
CREATE TRIGGER payment_attempts_touch_updated_at BEFORE UPDATE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION touch_banner_updated_at();

-- The source event is retained exactly once for signature-auditable, retry-safe processing.
CREATE TABLE payment_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9_-]{2,32}$'),
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  signature_valid boolean NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_error text,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX payment_webhook_inbox_pending_idx ON payment_webhook_inbox(received_at) WHERE processed_at IS NULL;

CREATE TYPE payment_reconciliation_status AS ENUM ('open','matched','investigating','resolved');
CREATE TABLE payment_reconciliation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id uuid NOT NULL REFERENCES payment_attempts(id),
  status payment_reconciliation_status NOT NULL DEFAULT 'open',
  reason text NOT NULL,
  external_reference text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolution_note text
);

CREATE INDEX payment_reconciliation_open_idx ON payment_reconciliation_cases(opened_at) WHERE status IN ('open','investigating');
CREATE UNIQUE INDEX payment_reconciliation_one_active_attempt_idx ON payment_reconciliation_cases(payment_attempt_id) WHERE status IN ('open','investigating');
