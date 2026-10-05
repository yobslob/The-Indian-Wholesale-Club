'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { OrderActions } from '@repo/db/store';

type Choice = 'cancel' | 'keep';

/**
 * What the customer may decide on their order (flows.md §7, §7b): after a delay, keep it with the new date or cancel
 * for everything back (D-008); before cutoff, cancel and get all but the tax back (D-042). Cancelling asks once more.
 */
export function OrderChoices({
  actions,
  orderNumber,
  email,
  window,
}: {
  actions: OrderActions;
  orderNumber: string;
  email: string;
  window: { from: string; to: string } | null;
}): React.JSX.Element | null {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const refund = actions.delay_open ? actions.delay_refund_cents : actions.cancel_refund_cents;
  if (!actions.delay_open && !actions.can_cancel) return null;

  async function decide(choice: Choice): Promise<void> {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/orders/choice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderNumber, email, choice }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setMessage(data.error ?? 'Something went wrong. Please try again.');
    setMessage(choice === 'keep' ? 'Thanks. Your order stays with the new date.' : 'Your order is cancelled. The refund is on its way.');
    router.refresh();
  }

  return (
    <section className="border-line space-y-3 rounded-lg border p-4" aria-live="polite">
      {actions.delay_open ? (
        <>
          <h2 className="text-ink font-medium">Your delivery date moved</h2>
          <p className="text-ink text-sm">
            {window ? `It now arrives ${formatDeliveryWindow(window.from, window.to)}. ` : ''}
            Keep your order with the new date, or cancel and get all {formatUsd(refund ?? 0)} back. Sorry about this.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-ink font-medium">Changed your mind?</h2>
          <p className="text-ink text-sm">
            You can cancel until we start preparing your order. You&apos;d get {formatUsd(refund ?? 0)} back: everything
            except the tax.
          </p>
        </>
      )}
      {message ? (
        <p className="text-ink text-sm" role="status">
          {message}
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {actions.delay_open ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('keep')}
              className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] disabled:opacity-50"
            >
              Keep my order
            </button>
          ) : null}
          {confirming ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide('cancel')}
              className="border-ink text-ink font-ui min-h-12 rounded-pill border px-6 text-[15px] disabled:opacity-50"
            >
              {busy ? 'Cancelling…' : `Yes, cancel and refund ${formatUsd(refund ?? 0)}`}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(true)}
              className="text-ink font-ui min-h-12 px-2 text-[15px] underline disabled:opacity-50"
            >
              Cancel my order
            </button>
          )}
        </div>
      )}
    </section>
  );
}
