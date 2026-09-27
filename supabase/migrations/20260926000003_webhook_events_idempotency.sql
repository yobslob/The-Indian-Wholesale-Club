-- =============================================================
-- Migration: webhook_events idempotency store (BUGS.md C8)
-- One row per processed Stripe event; unique event_id prevents
-- double processing when Stripe delivers redeliveries.
-- =============================================================

CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events (event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events (processed_at);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies: only the service role (webhook handlers) can read/write.
