'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCart } from '@/features/cart/store';

import { BagSummary } from './bag-summary';
import { confirmOrder } from './checkout-flow';
import { readLastOrder, type LastOrder } from './last-order';

/**
 * Thank-you page (D-087): today's text, then the pieces with photos, the total and the estimated delivery window from
 * this tab's last priced bag (last-order.ts; without it, the text alone). After a 3-D Secure redirect Stripe adds
 * ?payment_intent=…, so the order is confirmed here (the webhook does the same if this never runs).
 */
export function CheckoutSuccess({
  orderNumber,
  paymentIntentId,
}: {
  orderNumber: string | null;
  paymentIntentId: string | null;
}): React.JSX.Element {
  const clear = useCart((s) => s.clear);
  const [number, setNumber] = useState(orderNumber);
  const [message, setMessage] = useState<string | null>(null);
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => setOrder(readLastOrder({ orderNumber, paymentIntentId })), [orderNumber, paymentIntentId]);
  useEffect(() => {
    if (number || !paymentIntentId) return;
    void confirmOrder(paymentIntentId).then((result) => {
      if (result.orderNumber) {
        clear();
        setNumber(result.orderNumber);
      } else {
        setMessage(result.message ?? 'We are confirming your payment. We will email you shortly.');
      }
    });
  }, [number, paymentIntentId, clear]);

  if (!number) {
    return <p className="text-ink">{message ?? 'Confirming your order…'}</p>;
  }
  return (
    <div className="max-w-[720px] space-y-4">
      <h1 className="font-heading text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em] text-[#1D1A17]">Thank you!</h1>
      <p className="text-ink">
        Your order number is <strong>{number}</strong>. We have emailed your confirmation with the estimated delivery
        window.
      </p>
      {order ? (
        <div className="py-2">
          <BagSummary
            title="Your order"
            lines={order.lines}
            subtotalCents={order.quote.breakdown.subtotalCents}
            quote={order.quote}
          />
        </div>
      ) : null}
      <p className="text-ink-muted text-sm">
        Track it any time from{' '}
        <Link href={`/orders/${encodeURIComponent(number)}`} className="underline">
          your order page
        </Link>{' '}
        (you&apos;ll need the email you used).
      </p>
      <Link href="/states" className="text-ink-muted inline-block text-sm underline">
        Keep browsing
      </Link>
    </div>
  );
}
