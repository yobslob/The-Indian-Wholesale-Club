'use client';

import { useEffect, useState } from 'react';

import { formatUsd, formatUsPhone, usPhoneDigits } from '@repo/shared/domain';

import { EmptyLine } from '@/features/cart/cart-view';
import { cartCount, cartSubtotalCents, useCart } from '@/features/cart/store';

import { BagSummary } from './bag-summary';
import { readCheckout, takePaymentNotice } from './checkout-session';
import { DeliveryStep, deliverySummary, type Delivery } from './delivery-step';
import { PaymentStep } from './payment-step';
import { PhoneStep } from './phone-step';
import { SavedAddresses } from './saved-addresses';
import { Step } from './step';
import { useCheckoutPayment } from './use-checkout-payment';

import type { SummaryLine } from './last-order';
import type { CheckoutQuote, CheckoutRequestBody, SavedAddress, SavedDetails } from './types';

const NO_DELIVERY: Delivery = {
  fullName: '',
  email: '',
  zipCode: '',
  city: '',
  state: '',
  line1: '',
  line2: '',
  promoCode: '',
};

/** D-114: the delivery form filled from a saved address (the promo code stays what it was). */
function deliveryFrom(a: SavedAddress | null, email: string, promoCode: string): Delivery {
  if (!a) return { ...NO_DELIVERY, email, promoCode };
  return {
    fullName: a.fullName,
    email,
    zipCode: a.zipCode,
    city: a.city,
    state: a.state,
    line1: a.line1,
    line2: a.line2 ?? '',
    promoCode,
  };
}

/** A-8: the delivery form as it was sent with a saved checkout. */
function deliveryOf(body: CheckoutRequestBody): Delivery {
  const a = body.address;
  return {
    fullName: a.fullName,
    email: body.email,
    zipCode: a.zipCode,
    city: a.city,
    state: a.state,
    line1: a.line1,
    line2: a.line2 ?? '',
    promoCode: body.promoCode ?? '',
  };
}

/**
 * /checkout (D-087): 1. phone → 2. delivery → 3. payment on one page, each opening when the one before is done and
 * folding to a line with Edit; the bag beside them (a "Bag (n) · $…" bar on phones). Continue to payment prices the bag
 * on the server and holds one payment for that exact total (D-038); a re-price in the same visit moves its amount
 * (use-checkout-payment.ts, launch QA A-5). A refresh at Payment, or a failed 3-D Secure coming back, resumes there (A-8).
 * Signed in (D-114): the default saved address and its phone fill the steps (it opens at Delivery when the phone is
 * known), the other saved addresses can be picked, and the address of a paid order is saved (finalize.ts).
 */
export function CheckoutFlow({ saved }: { saved: SavedDetails | null }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const savedPromo = useCart((s) => s.promoCode);
  const [mounted, setMounted] = useState(false);
  const first = saved?.addresses[0] ?? null;
  const savedPhone = first?.phone ? usPhoneDigits(first.phone) : null;
  const [at, setAt] = useState<1 | 2 | 3>(savedPhone ? 2 : 1);
  const [phone, setPhone] = useState<string | null>(savedPhone);
  const [delivery, setDelivery] = useState<Delivery>(() =>
    deliveryFrom(first, saved?.email ?? '', savedPromo ?? ''),
  );
  const [picked, setPicked] = useState(first?.id ?? 'new');
  const [notice, setNotice] = useState<string | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [bagOpen, setBagOpen] = useState(false);

  /** The bag as the summary draws it: the server's price once priced, the device's before. */
  const summarize = (quote: CheckoutQuote | null): SummaryLine[] =>
    lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productName,
      variantLabel: l.variantLabel,
      regionName: l.regionName,
      quantity: l.quantity,
      imagePath: l.imagePath,
      totalCents:
        quote?.lines.find((q) => q.variantId === l.variantId)?.totalCents ??
        l.unitPriceCents * l.quantity,
    }));
  const payment = useCheckoutPayment(summarize);
  const { started, request, busy, error } = payment;

  async function go(body: CheckoutRequestBody, heldSecret: string | null = null): Promise<void> {
    if (await payment.post(body, heldSecret)) setAt(3);
  }

  useEffect(() => {
    setMounted(true);
    // A-8 / A-4: resume a checkout this tab started for this same bag, with any message from a failed payment.
    const resume = readCheckout(useCart.getState().lines);
    const message = takePaymentNotice();
    if (!resume) return;
    const digits = resume.request.address.phone
      ? usPhoneDigits(resume.request.address.phone)
      : null;
    if (digits) setPhone(digits);
    setDelivery(deliveryOf(resume.request));
    setFormVersion((v) => v + 1);
    setNotice(message);
    setAt(2);
    void go(resume.request, resume.clientSecret);
    // Once, on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0 && !started) return <EmptyLine />;

  const quote = started?.quote ?? null;
  const summaryLines = summarize(quote);

  function priceWith(d: Delivery): void {
    setDelivery(d);
    void go({
      email: d.email,
      address: {
        fullName: d.fullName,
        line1: d.line1,
        line2: d.line2 || null,
        city: d.city,
        state: d.state,
        zipCode: d.zipCode,
        phone: phone ? formatUsPhone(phone) : null,
      },
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      promoCode: d.promoCode || null,
      shippingMethod: request?.shippingMethod ?? 'standard',
    });
  }

  const edit = (step: 1 | 2) => () => {
    payment.drop();
    setNotice(null);
    setAt(step);
  };
  const stateOf = (n: 1 | 2 | 3): 'open' | 'done' | 'later' =>
    n === at ? 'open' : n < at ? 'done' : 'later';
  const total = quote ? quote.breakdown.totalCents : cartSubtotalCents(lines);

  return (
    <div className="grid items-start gap-[clamp(16px,2.4vw,40px)] min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div>
        <Step
          n={1}
          title="Phone"
          state={stateOf(1)}
          summary={phone ? formatUsPhone(phone) : ''}
          onEdit={edit(1)}
        >
          <PhoneStep
            value={phone}
            onDone={(digits) => {
              setPhone(digits);
              setAt(2);
            }}
          />
        </Step>
        <Step
          n={2}
          title="Delivery"
          state={stateOf(2)}
          summary={delivery.line1 ? deliverySummary(delivery) : ''}
          onEdit={edit(2)}
        >
          <SavedAddresses
            addresses={saved?.addresses ?? []}
            picked={picked}
            onPick={(a) => {
              setPicked(a?.id ?? 'new');
              setDelivery((d) => deliveryFrom(a, d.email, d.promoCode));
              const digits = a?.phone ? usPhoneDigits(a.phone) : null;
              if (digits) setPhone(digits);
            }}
          />
          {/* Keyed by the pick (and a resumed checkout): the form's fields start from that address. */}
          <DeliveryStep
            key={`${picked}-${formVersion}`}
            value={delivery}
            busy={busy}
            error={error}
            onDone={priceWith}
          />
        </Step>
        <Step n={3} title="Payment" state={stateOf(3)}>
          <PaymentStep
            payment={payment}
            delivery={delivery}
            phone={phone}
            notice={notice}
            onPrice={(body) => void go(body)}
          />
        </Step>
      </div>
      <aside
        aria-label="Your bag"
        className="-order-1 min-[900px]:sticky min-[900px]:top-[calc(var(--top-h)+16px)] min-[900px]:order-none"
      >
        <button
          type="button"
          onClick={() => setBagOpen((o) => !o)}
          aria-expanded={bagOpen}
          className="bg-surface font-ui mb-2 flex min-h-[52px] w-full items-center justify-between rounded-md px-4 text-[15px] font-semibold min-[900px]:hidden"
        >
          Bag ({cartCount(lines)}) · {formatUsd(total)}
          <span
            aria-hidden="true"
            className={`transition-transform ${bagOpen ? 'rotate-180' : ''}`}
          >
            ⌄
          </span>
        </button>
        <div className={bagOpen ? 'mb-2 block' : 'hidden min-[900px]:block'}>
          <BagSummary
            title="Your bag"
            lines={summaryLines}
            subtotalCents={cartSubtotalCents(lines)}
            quote={quote}
          />
        </div>
      </aside>
    </div>
  );
}
