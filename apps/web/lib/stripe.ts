import 'server-only';

import Stripe from 'stripe';

let stripe: Stripe | null = null;

/** Payments need both keys; dev uses Stripe test-mode keys (no fake payment path, R2). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function stripeServer(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing environment variable STRIPE_SECRET_KEY');
  stripe ??= new Stripe(key, { typescript: true });
  return stripe;
}
