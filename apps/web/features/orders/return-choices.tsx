'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import type { OrderDetail, OrderReturnOption } from '@repo/db/store';

type Reason = 'damaged' | 'wrong' | 'changed_mind';

const REASON_LABEL: Record<Reason, string> = {
  damaged: 'It arrived damaged',
  wrong: 'It is not what I ordered',
  changed_mind: 'I changed my mind',
};

/**
 * Returning a delivered piece (D-071). The refund for each reason comes from the database: a damaged or wrong piece,
 * reported in time, gets everything back; a change of mind, for unworn and unaltered clothing, keeps a share that
 * grows with time. The money goes back once the piece is received. Asking asks once more.
 */
export function ReturnChoices({
  returns,
  items,
  orderNumber,
  email,
}: {
  returns: OrderReturnOption[];
  items: OrderDetail['items'];
  orderNumber: string;
  email: string;
}): React.JSX.Element | null {
  const router = useRouter();
  const [picked, setPicked] = useState<{ itemId: string; reason: Reason } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const open = returns.filter((r) => r.requested || r.claim_refund_cents !== null || r.change_of_mind_refund_cents !== null);
  if (open.length === 0) return null;

  const refundFor = (r: OrderReturnOption, reason: Reason): number | null =>
    reason === 'changed_mind' ? r.change_of_mind_refund_cents : r.claim_refund_cents;

  async function ask(itemId: string, reason: Reason): Promise<void> {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/orders/return', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderNumber, email, itemId, reason }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    setPicked(null);
    if (!res.ok) return setMessage(data.error ?? 'Something went wrong. Please try again.');
    setMessage('Thanks. We will be in touch to collect it from your door. Your refund goes out once it reaches us.');
    router.refresh();
  }

  return (
    <section className="border-line space-y-3 rounded-lg border p-4" aria-live="polite">
      <h2 className="text-ink font-medium">Return a piece</h2>
      {message ? (
        <p className="text-ink text-sm" role="status">
          {message}
        </p>
      ) : null}
      <ul className="space-y-4">
        {open.map((r) => {
          const item = items.find((i) => i.id === r.item_id);
          const reasons = (['damaged', 'wrong', 'changed_mind'] as const).filter((x) => refundFor(r, x) !== null);
          return (
            <li key={r.item_id} className="space-y-2">
              <p className="text-ink text-sm">
                {item ? `${item.product_name} (${item.variant_label})` : 'A piece'}
              </p>
              {r.requested ? (
                <p className="text-ink-muted text-sm">Return requested. Your refund goes out once it reaches us.</p>
              ) : picked?.itemId === r.item_id ? (
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void ask(r.item_id, picked.reason)}
                    className="border-ink text-ink font-ui min-h-12 rounded-pill border px-6 text-[15px] disabled:opacity-50"
                  >
                    {busy ? 'Sending…' : `Yes, return it for ${formatUsd(refundFor(r, picked.reason) ?? 0)}`}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setPicked(null)}
                    className="text-ink font-ui min-h-12 px-2 text-[15px] underline"
                  >
                    Not now
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {reasons.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setPicked({ itemId: r.item_id, reason })}
                      className="text-ink font-ui min-h-11 text-left text-[15px] underline"
                    >
                      {REASON_LABEL[reason]}: {formatUsd(refundFor(r, reason) ?? 0)} back
                    </button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {open.some((r) => r.change_of_mind_refund_cents !== null && !r.requested) ? (
        <p className="text-ink-muted text-xs">
          A change of mind is for unworn, unaltered pieces. Part of the price is kept for bringing it back, more as time
          goes on.
        </p>
      ) : null}
    </section>
  );
}
