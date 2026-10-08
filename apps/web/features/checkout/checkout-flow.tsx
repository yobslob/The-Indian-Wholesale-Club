'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatUsd, US_STATES } from '@repo/shared/domain';

import { useCart } from '@/features/cart/store';

import { OrderSummary } from './order-summary';
import { PaymentForm } from './payment-form';
import { ShippingPicker } from './shipping-picker';

import type {
  CheckoutErrorResponse,
  CheckoutRequestBody,
  CheckoutStartResponse,
  FinalizeResponse,
} from './types';

const input = 'min-h-12 w-full rounded-md border border-line bg-paper px-3.5 text-[15px] outline-none focus:border-ink';

function Field(props: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="font-ui text-ink block text-[13px] font-medium">
      {props.label}
      <input
        name={props.name}
        type={props.type ?? 'text'}
        required={props.required}
        autoComplete={props.autoComplete}
        defaultValue={props.defaultValue ?? undefined}
        className={input}
      />
    </label>
  );
}

/** Finish the order for a paid PaymentIntent (also used after a 3-D Secure redirect). */
export async function confirmOrder(
  paymentIntentId: string,
): Promise<{ orderNumber?: string; message?: string }> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paymentIntentId }),
  });
  const body = (await res.json()) as FinalizeResponse | CheckoutErrorResponse;
  return 'orderNumber' in body ? { orderNumber: body.orderNumber } : { message: body.error };
}

/** /checkout: details → server-priced summary + delivery window → Stripe payment → order. */
export function CheckoutFlow(): React.JSX.Element {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const clear = useCart((s) => s.clear);
  const savedPromo = useCart((s) => s.promoCode);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState<CheckoutStartResponse | null>(null);
  const [request, setRequest] = useState<CheckoutRequestBody | null>(null);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <p className="text-ink-muted text-sm">Loading your bag…</p>;
  if (lines.length === 0 && !started) {
    return (
      <p className="text-ink">
        Your bag is empty.{' '}
        <Link href="/states" className="underline">
          Find something from home
        </Link>
        .
      </p>
    );
  }

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
    if ('clientSecret' in json) setStarted(json);
    else setError(json.error);
  }

  async function start(form: FormData): Promise<void> {
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const body: CheckoutRequestBody = {
      email: text('email'),
      address: {
        fullName: text('fullName'),
        line1: text('line1'),
        line2: text('line2') || null,
        city: text('city'),
        state: text('state'),
        zipCode: text('zipCode'),
        phone: text('phone') || null,
      },
      lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
      promoCode: text('promoCode') || null,
      shippingMethod: request?.shippingMethod ?? 'standard',
    };
    await post(body);
  }

  async function paid(paymentIntentId: string, status: string): Promise<void> {
    if (status !== 'succeeded') {
      router.push(`/checkout/success?payment_intent=${encodeURIComponent(paymentIntentId)}`);
      return;
    }
    const result = await confirmOrder(paymentIntentId);
    if (result.orderNumber) {
      clear();
      router.push(`/checkout/success?order=${encodeURIComponent(result.orderNumber)}`);
    } else {
      setError(result.message ?? 'We could not confirm your order.');
    }
  }

  if (started) {
    return (
      <div className="grid gap-8 md:grid-cols-2">
        <OrderSummary quote={started.quote} />
        <div className="space-y-4">
          <h2 className="font-heading text-ink text-[clamp(22px,1.8vw,30px)] font-medium tracking-[-0.02em]">Payment</h2>
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <ShippingPicker
            quote={started.quote}
            disabled={busy}
            onChange={(method) => request && void post({ ...request, shippingMethod: method })}
          />
          <PaymentForm
            key={started.clientSecret}
            clientSecret={started.clientSecret}
            totalLabel={formatUsd(started.quote.breakdown.totalCents)}
            onPaid={(id, status) => void paid(id, status)}
          />
          <button type="button" onClick={() => setStarted(null)} className="text-sm underline">
            Change details
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void start(new FormData(event.currentTarget));
      }}
      className="grid max-w-xl gap-4"
    >
      <Field
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        defaultValue={request?.email}
      />
      <Field
        name="fullName"
        label="Full name"
        autoComplete="name"
        required
        defaultValue={request?.address.fullName}
      />
      <Field
        name="line1"
        label="Street address"
        autoComplete="address-line1"
        required
        defaultValue={request?.address.line1}
      />
      <Field
        name="line2"
        label="Apartment, suite (optional)"
        autoComplete="address-line2"
        defaultValue={request?.address.line2}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          name="city"
          label="City"
          autoComplete="address-level2"
          required
          defaultValue={request?.address.city}
        />
        <label className="font-ui text-ink block text-[13px] font-medium">
          State
          <select
            name="state"
            required
            autoComplete="address-level1"
            className={input}
            defaultValue={request?.address.state ?? ''}
          >
            <option value="" disabled>
              Choose…
            </option>
            {US_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          name="zipCode"
          label="ZIP code"
          autoComplete="postal-code"
          required
          defaultValue={request?.address.zipCode}
        />
        <Field
          name="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          defaultValue={request?.address.phone}
        />
      </div>
      <label className="font-ui text-ink block text-[13px] font-medium">
        Promo code (optional)
        <input
          name="promoCode"
          defaultValue={request?.promoCode ?? savedPromo ?? ''}
          className={input}
        />
      </label>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium disabled:opacity-50"
      >
        {busy ? 'Checking your bag…' : 'Continue to payment'}
      </button>
      <p className="text-ink-muted text-xs">
        US addresses only. You will see the total and delivery window before paying.
      </p>
    </form>
  );
}
