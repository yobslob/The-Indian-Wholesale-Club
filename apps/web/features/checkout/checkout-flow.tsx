'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatUsd, formatUsPhone, usPhoneDigits } from '@repo/shared/domain';

import { EmptyLine } from '@/features/cart/cart-view';
import { cartCount, cartSubtotalCents, useCart } from '@/features/cart/store';

import { BagSummary } from './bag-summary';
import { DeliveryStep, deliverySummary, type Delivery } from './delivery-step';
import { saveLastOrder, type SummaryLine } from './last-order';
import { PaymentForm } from './payment-form';
import { PhoneStep } from './phone-step';
import { SavedAddresses } from './saved-addresses';
import { ShippingPicker } from './shipping-picker';
import { Step } from './step';

import type {
  CheckoutErrorResponse,
  CheckoutRequestBody,
  CheckoutStartResponse,
  FinalizeResponse,
  SavedAddress,
  SavedDetails,
} from './types';

/** Finish the order for a paid PaymentIntent (also used after a 3-D Secure redirect). */
export async function confirmOrder(paymentIntentId: string): Promise<{ orderNumber?: string; message?: string }> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  });
  const body = (await res.json()) as FinalizeResponse | CheckoutErrorResponse;
  return 'orderNumber' in body ? { orderNumber: body.orderNumber } : { message: body.error };
}

const NO_DELIVERY: Delivery = { fullName: '', email: '', zipCode: '', city: '', state: '', line1: '', line2: '', promoCode: '' };

/** D-114: the delivery form filled from a saved address (the promo code stays what it was). */
function deliveryFrom(a: SavedAddress | null, email: string, promoCode: string): Delivery {
  if (!a) return { ...NO_DELIVERY, email, promoCode };
  return { fullName: a.fullName, email, zipCode: a.zipCode, city: a.city, state: a.state, line1: a.line1, line2: a.line2 ?? '', promoCode };
}

/**
 * /checkout (D-087): 1. phone → 2. delivery → 3. payment on one page, each opening when the one before is done and
 * folding to a line with Edit; the bag beside them (a "Bag (n) · $…" bar on phones). Continue to payment prices the bag
 * on the server and creates the payment for that exact total (D-038); editing an earlier step drops that payment.
 * Signed in (D-114): the default saved address and its phone fill the steps (it opens at Delivery when the phone is
 * known), the other saved addresses can be picked, and the address of a paid order is saved (finalize.ts).
 */
export function CheckoutFlow({ saved }: { saved: SavedDetails | null }): React.JSX.Element {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const savedPromo = useCart((s) => s.promoCode);
  const [mounted, setMounted] = useState(false);
  const first = saved?.addresses[0] ?? null;
  const savedPhone = first?.phone ? usPhoneDigits(first.phone) : null;
  const [at, setAt] = useState<1 | 2 | 3>(savedPhone ? 2 : 1);
  const [phone, setPhone] = useState<string | null>(savedPhone);
  const [delivery, setDelivery] = useState<Delivery>(() => deliveryFrom(first, saved?.email ?? '', savedPromo ?? ''));
  const [picked, setPicked] = useState(first?.id ?? 'new');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<CheckoutStartResponse | null>(null);
  const [request, setRequest] = useState<CheckoutRequestBody | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0 && !started) return <EmptyLine />;

  const quote = started?.quote ?? null;
  const summaryLines: SummaryLine[] = lines.map((l) => ({
    variantId: l.variantId,
    productName: l.productName,
    variantLabel: l.variantLabel,
    regionName: l.regionName,
    quantity: l.quantity,
    imagePath: l.imagePath,
    totalCents: quote?.lines.find((q) => q.variantId === l.variantId)?.totalCents ?? l.unitPriceCents * l.quantity,
  }));

  /** Prices the bag on the server and creates the payment for that exact total. */
  async function post(body: CheckoutRequestBody): Promise<void> {
    setBusy(true);
    setError(null);
    setRequest(body);
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as CheckoutStartResponse | CheckoutErrorResponse;
    setBusy(false);
    if (!('clientSecret' in json)) {
      setError(json.error);
      return;
    }
    setStarted(json);
    setAt(3);
    saveLastOrder({ paymentIntentId: json.paymentIntentId, orderNumber: null, lines: summaryLines, quote: json.quote, state: body.address.state });
  }

  function priceWith(d: Delivery): void {
    setDelivery(d);
    void post({
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

  async function paid(paymentIntentId: string, status: string): Promise<void> {
    if (status !== 'succeeded') {
      router.push(`/checkout/success?payment_intent=${encodeURIComponent(paymentIntentId)}`);
      return;
    }
    const result = await confirmOrder(paymentIntentId);
    if (result.orderNumber) {
      if (started)
        saveLastOrder({ paymentIntentId, orderNumber: result.orderNumber, lines: summaryLines, quote: started.quote, state: request?.address.state ?? null });
      clear();
      router.push(`/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
    } else {
      setError(result.message ?? 'We could not confirm your order.');
    }
  }

  const edit = (step: 1 | 2) => () => {
    setStarted(null);
    setError(null);
    setAt(step);
  };
  const stateOf = (n: 1 | 2 | 3): 'open' | 'done' | 'later' => (n === at ? 'open' : n < at ? 'done' : 'later');
  const total = quote ? quote.breakdown.totalCents : cartSubtotalCents(lines);

  return (
    <div className="grid items-start gap-[clamp(16px,2.4vw,40px)] min-[900px]:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div>
        <Step n={1} title="Phone" state={stateOf(1)} summary={phone ? formatUsPhone(phone) : ''} onEdit={edit(1)}>
          <PhoneStep
            value={phone}
            onDone={(digits) => {
              setPhone(digits);
              setAt(2);
            }}
          />
        </Step>
        <Step n={2} title="Delivery" state={stateOf(2)} summary={delivery.line1 ? deliverySummary(delivery) : ''} onEdit={edit(2)}>
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
          {/* Keyed by the pick: the form's fields start from the address picked. */}
          <DeliveryStep key={picked} value={delivery} busy={busy} error={error} onDone={priceWith} />
        </Step>
        <Step n={3} title="Payment" state={stateOf(3)}>
          {started && request ? (
            <>
              <ShippingPicker
                quote={started.quote}
                disabled={busy}
                onChange={(method) => void post({ ...request, shippingMethod: method })}
              />
              {error ? (
                <p className="text-danger mb-3 text-sm" role="alert">
                  {error}
                </p>
              ) : null}
              <PaymentForm
                key={started.clientSecret}
                clientSecret={started.clientSecret}
                totalLabel={formatUsd(started.quote.breakdown.totalCents)}
                onPaid={(id, status) => void paid(id, status)}
                billing={{
                  name: delivery.fullName,
                  email: delivery.email,
                  phone: phone ? `+1${phone}` : undefined,
                  address: {
                    line1: delivery.line1,
                    line2: delivery.line2 || undefined,
                    city: delivery.city,
                    state: delivery.state,
                    postal_code: delivery.zipCode,
                    country: 'US',
                  },
                }}
              />
            </>
          ) : null}
        </Step>
      </div>
      <aside aria-label="Your bag" className="-order-1 min-[900px]:sticky min-[900px]:top-[calc(var(--top-h)+16px)] min-[900px]:order-none">
        <button
          type="button"
          onClick={() => setBagOpen((o) => !o)}
          aria-expanded={bagOpen}
          className="bg-surface font-ui mb-2 flex min-h-[52px] w-full items-center justify-between rounded-md px-4 text-[15px] font-semibold min-[900px]:hidden"
        >
          Bag ({cartCount(lines)}) · {formatUsd(total)}
          <span aria-hidden="true" className={`transition-transform ${bagOpen ? 'rotate-180' : ''}`}>
            ⌄
          </span>
        </button>
        <div className={bagOpen ? 'mb-2 block' : 'hidden min-[900px]:block'}>
          <BagSummary title="Your bag" lines={summaryLines} subtotalCents={cartSubtotalCents(lines)} quote={quote} />
        </div>
      </aside>
    </div>
  );
}
