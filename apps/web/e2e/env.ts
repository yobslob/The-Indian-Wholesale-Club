import { createClient } from '@supabase/supabase-js';

import type { Database } from '@repo/db';

/**
 * E2E accounts (created by global-setup in the LOCAL database only). The domain
 * is reserved (.test), so nothing can ever be delivered to it.
 */
export const E2E_ADMIN = { email: 'e2e-admin@iwc.test', password: 'e2e-admin-password-1' };
export const E2E_CUSTOMER = { email: 'e2e-customer@iwc.test', password: 'e2e-customer-password-1' };

/** The demo product from supabase/seed/demo.sql (dev only). */
export const DEMO_PRODUCT = { region: 'kerala', slug: 'demo-kerala-kasavu-saree' };

/** Products created by the admin test start with this slug, so teardown can find them. */
export const E2E_SLUG_PREFIX = 'e2e-';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * The tests write to the database (users, orders, products) and pay with Stripe.
 * They refuse anything but local Supabase and Stripe test keys (ops.md §Database workflow).
 */
export function assertSafeEnvironment(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    /* reported below */
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `E2E refuses to run: NEXT_PUBLIC_SUPABASE_URL must be local Supabase (got "${url || 'unset'}"). See docs/ops.md.`,
    );
  }
  const secret = process.env.STRIPE_SECRET_KEY ?? '';
  if (secret && !secret.startsWith('sk_test_')) {
    throw new Error(
      'E2E refuses to run with a live Stripe key (STRIPE_SECRET_KEY must start with sk_test_).',
    );
  }
}

/** True when checkout can run: Stripe test keys on both sides. */
export function stripeTestKeysPresent(): boolean {
  return (
    (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_') &&
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '').startsWith('pk_test_')
  );
}

/** Service-role client for setup and teardown only (never used by a page under test). */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error(
      'E2E needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (apps/web/.env.local).',
    );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
