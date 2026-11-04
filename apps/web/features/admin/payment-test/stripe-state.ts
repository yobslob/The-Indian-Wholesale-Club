import 'server-only';

import { TEST_PAYMENT_KIND } from '@/features/checkout/test-payment';
import { errorMessage, logger } from '@/lib/logger';
import { stripeServer } from '@/lib/stripe';

import type Stripe from 'stripe';

/**
 * What the admin's payment test shows (admin.md §Payment test): whether the Stripe account behind the live keys can
 * take card payments and pay them out, where payouts go, and a test payment's card and status. Admin only.
 */
export interface StripeAccountState {
  live: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Where payouts go: "Chase •••• 6789", "Visa debit •••• 4242", or null when none is added. */
  payoutTo: string[];
  /** What Stripe still asks for before charges or payouts (its own field names, e.g. external_account). */
  due: string[];
  disabledReason: string | null;
  availableCents: number;
  pendingCents: number;
}

function payoutTarget(account: Stripe.BankAccount | Stripe.Card): string {
  if (account.object === 'bank_account')
    return `${account.bank_name ?? 'Bank'} •••• ${account.last4}`;
  return `${account.brand} ${account.funding} card •••• ${account.last4}`;
}

const usd = (amounts: { amount: number; currency: string }[]): number =>
  amounts.filter((a) => a.currency === 'usd').reduce((sum, a) => sum + a.amount, 0);

export async function stripeAccountState(): Promise<StripeAccountState | { error: string }> {
  const stripe = stripeServer();
  try {
    const [account, balance] = await Promise.all([
      stripe.accounts.retrieveCurrent(),
      stripe.balance.retrieve(),
    ]);
    return {
      live: balance.livemode,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      payoutTo: (account.external_accounts?.data ?? []).map(payoutTarget),
      due: [
        ...(account.requirements?.currently_due ?? []),
        ...(account.requirements?.past_due ?? []),
      ].filter((v, i, all) => all.indexOf(v) === i),
      disabledReason: account.requirements?.disabled_reason ?? null,
      availableCents: usd(balance.available),
      pendingCents: usd(balance.pending),
    };
  } catch (error) {
    logger.warn('admin.payment_test_account_failed', { error: errorMessage(error) });
    return { error: errorMessage(error) };
  }
}

export interface TestPaymentResult {
  id: string;
  status: string;
  amountCents: number;
  /** "visa •••• 4242 (debit, US)" */
  card: string | null;
  refundedCents: number;
  failure: string | null;
}

/** A payment made on the test page, read back from Stripe; null for any other payment id. */
export async function testPaymentResult(id: string): Promise<TestPaymentResult | null> {
  if (!/^pi_[A-Za-z0-9]+$/.test(id)) return null;
  try {
    const intent = await stripeServer().paymentIntents.retrieve(id, { expand: ['latest_charge'] });
    if (intent.metadata.kind !== TEST_PAYMENT_KIND) return null;
    const charge = typeof intent.latest_charge === 'object' ? intent.latest_charge : null;
    const card = charge?.payment_method_details?.card;
    return {
      id: intent.id,
      status: intent.status,
      amountCents: intent.amount,
      card: card
        ? `${card.brand} •••• ${card.last4} (${card.funding}, ${card.country ?? '?'})`
        : null,
      refundedCents: charge?.amount_refunded ?? 0,
      failure: intent.last_payment_error?.message ?? charge?.failure_message ?? null,
    };
  } catch (error) {
    logger.warn('admin.payment_test_read_failed', { error: errorMessage(error) });
    return null;
  }
}
