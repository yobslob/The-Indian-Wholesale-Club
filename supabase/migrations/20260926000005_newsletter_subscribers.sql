-- =====================================================
-- Newsletter subscribers (H14/N12)
-- Persist signups instead of returning fake success.
-- =====================================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'website',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
    ON newsletter_subscribers (created_at DESC);

-- RLS on with no public policies: writes happen only through the
-- service-role client in /api/newsletter.
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Idempotent upsert target: uniqueness on email.
