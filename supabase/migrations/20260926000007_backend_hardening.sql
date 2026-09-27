-- Backend hardening: guest checkout RLS and durable email delivery.

DROP POLICY IF EXISTS "Users can create orders" ON orders;
CREATE POLICY "Customers and guests can create orders"
  ON orders FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own orders"
  ON orders FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own order items"
  ON order_items FOR UPDATE
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own order items"
  ON order_items FOR DELETE
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own tracking events"
  ON tracking_events FOR UPDATE
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own tracking events"
  ON tracking_events FOR DELETE
  USING (order_id IN (SELECT id FROM orders WHERE user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  recipient TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'dead_letter')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_ready
  ON email_outbox (next_attempt_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to email_outbox"
  ON email_outbox FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS admin_error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE admin_error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access to admin_error_events"
  ON admin_error_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
