'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { useCart } from '@/features/cart/store';

import { BagSummary } from './bag-summary';
import { confirmOrder } from './checkout-flow';
import { readLastOrder, type LastOrder } from './last-order';
import { OrderStitch, StitchRunning } from './stitch';

/**
 * Thank-you page (D-087): today's text, then the pieces with photos, the total and the estimated delivery window from
 * this tab's last priced bag (last-order.ts; without it, the text alone). After a 3-D Secure redirect Stripe adds
 * ?payment_intent=…, so the order is confirmed here (the webhook does the same if this never runs).
 * D-140 (F7): the running stitch sews from India to the customer's state while the number, the window and the buttons
 * are there from the first frame; on wide screens the message and the stitch on the left, the order on the right; a
 * signed-in customer gets "View your order" instead of the email note; confirming shows the same stitch running.
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
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let live = true;
    void import('@/lib/supabase/browser').then(async ({ browserClient }) => {
      const { data } = await browserClient().auth.getSession();
      if (live) setSignedIn(Boolean(data.session));
    });
    return () => {
      live = false;
    };
  }, []);

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
    return message ? <p className="text-ink">{message}</p> : <StitchRunning label="Confirming your order…" />;
  }
  return (
    <div className="grid items-start gap-[clamp(24px,4vw,64px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <div className="space-y-4">
        <h1 className="font-heading text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em] text-[#1D1A17]">Thank you!</h1>
        <p className="text-ink">
          Your order number is <strong>{number}</strong>.{' '}
          {signedIn ? 'Your confirmation is in your email too.' : 'We have emailed your confirmation with the estimated delivery window.'}
        </p>
        <OrderStitch state={order?.state ?? null} />
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/orders/${encodeURIComponent(number)}`} className="bg-brand text-on-brand font-ui press rounded-pill inline-flex min-h-12 items-center px-6 text-[15px] font-medium">
            View your order
          </Link>
          <Link href="/states" className="text-ink-muted font-ui text-sm underline">
            Keep browsing
          </Link>
        </div>
        {signedIn ? null : (
          <p className="text-ink-muted text-sm">You&apos;ll need the email you used to open it.</p>
        )}
      </div>
      {order ? (
        <div className="lg:pt-2">
          <BagSummary title="Your order" lines={order.lines} subtotalCents={order.quote.breakdown.subtotalCents} quote={order.quote} />
        </div>
      ) : null}
    </div>
  );
}
