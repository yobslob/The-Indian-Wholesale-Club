/**
 * Does a Stripe PaymentIntent pay for exactly the checkout we stored? (flows.md §3, D-038)
 * Pure, so it has unit tests (tests/payment-check.test.ts).
 *
 * The mode check compares the intent with the key the server runs on: a live key must only
 * ever confirm live payments, and a test key test payments. It used to demand live mode in
 * every production build, which refused every test payment on a production build with test
 * keys (found by the E2E checkout flow, 2026-09-29).
 */
export function paymentMatchesCheckout(
  intent: { amount: number; currency: string; livemode: boolean },
  expectedTotalCents: number,
  stripeSecretKey: string,
): boolean {
  const liveKey = stripeSecretKey.startsWith('sk_live_') || stripeSecretKey.startsWith('rk_live_');
  return (
    intent.amount === expectedTotalCents &&
    intent.currency.toLowerCase() === 'usd' &&
    intent.livemode === liveKey
  );
}
