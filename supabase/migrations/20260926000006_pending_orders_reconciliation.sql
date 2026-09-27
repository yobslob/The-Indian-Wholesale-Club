-- N10: Pending orders table for Stripe webhook reconciliation.
-- When a PaymentIntent is created, the checkout payload is stored here so
-- the webhook can create the order if the browser never POSTs /api/orders/create.

CREATE TABLE IF NOT EXISTS pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id TEXT UNIQUE NOT NULL,
  checkout_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_at TIMESTAMPTZ,
  reconciled_by TEXT CHECK (reconciled_by IN ('browser', 'webhook'))
);

-- Index for quick lookup by payment_intent_id (already UNIQUE but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_pending_orders_pi ON pending_orders(payment_intent_id);

-- Auto-cleanup: remove reconciled rows older than 7 days (can be run by cron)
-- For now, just index on created_at for potential cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_orders_created ON pending_orders(created_at);

-- Failed reconciliations table: records charges that could not be matched to orders
-- even after webhook retry exhaustion. Requires manual intervention.
CREATE TABLE IF NOT EXISTS failed_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id TEXT NOT NULL,
  stripe_event_id TEXT,
  amount_cents INTEGER,
  currency TEXT,
  customer_email TEXT,
  error_reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_failed_reconciliations_pi ON failed_reconciliations(payment_intent_id);

-- Enable RLS on both tables (service-role only)
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_reconciliations ENABLE ROW LEVEL SECURITY;

-- Only service role can access these tables
CREATE POLICY "Service role full access to pending_orders"
  ON pending_orders FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to failed_reconciliations"
  ON failed_reconciliations FOR ALL
  USING (auth.role() = 'service_role');
