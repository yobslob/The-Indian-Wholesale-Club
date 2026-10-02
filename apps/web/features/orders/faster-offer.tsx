'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { OrderOffer } from '@repo/db/store';

// Stripe loads only when someone takes the offer (PR-4: no payment code on order pages by default).
const PaymentForm = dynamic(() => import('@/features/checkout/payment-form').then((m) => m.PaymentForm), {
  ssr: false,
});

type State =
  | { step: 'offer' }
  | { step: 'starting' }
  | { step: 'paying'; clientSecret: string }
  | { step: 'confirming' }
  | { step: 'done' }
  | { step: 'problem'; message: string };

async function post<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: (await res.json().catch(() => ({}))) as T };
}

/**
 * D-064: the order can reach the customer sooner than promised, for a small price. Paying moves the delivery
 * estimate to the earlier window; ignoring it changes nothing. Never says why it is early (D-003).
 */
export function FasterOffer({
  offer,
  orderNumber,
  email,
}: {
  offer: OrderOffer;
  orderNumber: string;
  email: string;
}): React.JSX.Element {
  const router = useRouter();
  const [state, setState] = useState<State>({ step: 'offer' });
  const sooner = formatDeliveryWindow(offer.est_delivery_from, offer.est_delivery_to);

  async function confirm(paymentIntentId: string): Promise<void> {
    setState({ step: 'confirming' });
    const res = await post<{ error?: string }>('/api/orders/faster/confirm', { paymentIntentId });
    if (res.ok) {
      setState({ step: 'done' });
      router.refresh();
    } else {
      setState({ step: 'problem', message: res.data.error ?? 'We could not confirm this payment.' });
    }
  }

  // Back from a card check (3-D Secure) on another page.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const intent = params.get('payment_intent');
    if (intent && params.get('redirect_status') === 'succeeded') void confirm(intent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  async function start(): Promise<void> {
    setState({ step: 'starting' });
    const res = await post<{ clientSecret?: string; error?: string }>('/api/orders/faster', {
      orderNumber,
      email,
    });
    if (res.ok && res.data.clientSecret) setState({ step: 'paying', clientSecret: res.data.clientSecret });
    else setState({ step: 'problem', message: res.data.error ?? 'This offer is no longer open.' });
  }

  return (
    <section className="border-ink space-y-3 rounded-lg border p-4" aria-live="polite">
      {state.step === 'done' ? (
        <p className="text-ink">Done. It should reach you {sooner}.</p>
      ) : (
        <>
          <h2 className="text-ink font-medium">It can reach you sooner</h2>
          <p className="text-ink text-sm">
            Want it {sooner}? That&apos;s {formatUsd(offer.price_cents)}. Or do nothing and it still arrives by the
            date above.
          </p>
          {state.step === 'paying' ? (
            <PaymentForm
              clientSecret={state.clientSecret}
              totalLabel={formatUsd(offer.price_cents)}
              returnPath={window.location.pathname}
              onPaid={(id) => void confirm(id)}
            />
          ) : state.step === 'problem' ? (
            <p className="text-danger text-sm" role="alert">
              {state.message}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={state.step !== 'offer'}
              className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] disabled:opacity-50"
            >
              {state.step === 'offer' ? `Get it sooner for ${formatUsd(offer.price_cents)}` : 'One moment…'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
