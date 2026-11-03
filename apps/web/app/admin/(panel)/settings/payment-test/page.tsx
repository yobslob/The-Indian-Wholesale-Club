import { formatUsd } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import { stripeAccountState, testPaymentResult } from '@/features/admin/payment-test/stripe-state';
import { RefundTestPayment, TestPayment } from '@/features/admin/payment-test/test-payment';
import { PageHead, Panel } from '@/features/admin/ui';
import { isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex gap-3 py-1.5 text-[14px]">
      <dt className="text-ink-muted w-44 flex-none">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const yes = (on: boolean): string => (on ? 'Yes' : 'No');

/**
 * The payment test (admin.md §Payment test): is the Stripe account behind this deployment's keys able to take a card
 * and pay out, and a $1 payment through the store's own card form to prove it. Not linked from anywhere; admin only.
 */
export default async function PaymentTestPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}): Promise<React.JSX.Element> {
  await requireAdminPage();
  const { payment_intent: paymentIntentId } = await searchParams;
  if (!isStripeConfigured())
    return (
      <>
        <PageHead title="Payment test" />
        <p className="text-danger text-sm">Stripe keys are not set on this deployment.</p>
      </>
    );
  const [account, result] = await Promise.all([
    stripeAccountState(),
    paymentIntentId ? testPaymentResult(paymentIntentId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHead
        title="Payment test"
        sub="A $1 card payment through the store's own card form. No order is made; refund it here after."
      />
      <div className="grid max-w-2xl gap-4">
        <Panel title="The Stripe account">
          {'error' in account ? (
            <p className="text-danger text-sm">Stripe did not answer: {account.error}</p>
          ) : (
            <dl>
              <Row label="Keys">
                {account.live ? 'Live (real money)' : 'Test mode (no real money)'}
              </Row>
              <Row label="Can take payments">{yes(account.chargesEnabled)}</Row>
              <Row label="Can pay out">{yes(account.payoutsEnabled)}</Row>
              <Row label="Payouts go to">
                {account.payoutTo.length
                  ? account.payoutTo.join(', ')
                  : 'Nothing added yet: money waits in Stripe'}
              </Row>
              <Row label="Balance">
                {formatUsd(account.availableCents)} available · {formatUsd(account.pendingCents)} on
                the way
              </Row>
              {account.due.length || account.disabledReason ? (
                <Row label="Stripe still needs">
                  <span className="text-danger">
                    {[account.disabledReason, ...account.due].filter(Boolean).join(', ')}
                  </span>
                  <br />
                  <span className="text-ink-muted">
                    Stripe dashboard → Settings → Business (or the banner on Home).
                  </span>
                </Row>
              ) : null}
            </dl>
          )}
        </Panel>

        {result ? (
          <Panel title="The test payment">
            <dl>
              <Row label="Status">{result.status === 'succeeded' ? 'Paid' : result.status}</Row>
              <Row label="Amount">{formatUsd(result.amountCents)}</Row>
              <Row label="Card">{result.card ?? '—'}</Row>
              {result.failure ? <Row label="Why it failed">{result.failure}</Row> : null}
              <Row label="Refunded">{formatUsd(result.refundedCents)}</Row>
              <Row label="Stripe id">{result.id}</Row>
            </dl>
            {result.status === 'succeeded' && result.refundedCents === 0 ? (
              <div className="mt-3">
                <RefundTestPayment paymentIntentId={result.id} />
              </div>
            ) : null}
          </Panel>
        ) : null}

        <Panel title={result ? 'Another test' : 'Pay $1'}>
          {/* a fresh start after each payment (the form above it is done) */}
          <TestPayment key={result?.id ?? 'new'} />
        </Panel>
      </div>
    </>
  );
}
