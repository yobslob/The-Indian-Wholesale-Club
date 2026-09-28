'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { formatUsd, US_STATES } from '@repo/shared/domain';

import { useCart } from '@/features/cart/store';

import { OrderSummary } from './order-summary';
import { PaymentForm } from './payment-form';

import type {
  CheckoutErrorResponse,
  CheckoutRequestBody,
  CheckoutStartResponse,
  FinalizeResponse,
} from './types';

const input = 'min-h-11 w-full rounded-sm border border-line bg-canvas px-3';

function Field(props: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="text-ink block text-sm">
      {props.label}
      <input
        name={props.name}
        type={props.type ?? 'text'}
        required={props.required}
        autoComplete={props.autoComplete}
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

  async function start(form: FormData): Promise<void> {
    setBusy(true);
    setError(null);
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
    };
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
          <h2 className="text-ink text-lg font-medium">Payment</h2>
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <PaymentForm
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
      <Field name="email" label="Email" type="email" autoComplete="email" required />
      <Field name="fullName" label="Full name" autoComplete="name" required />
      <Field name="line1" label="Street address" autoComplete="address-line1" required />
      <Field name="line2" label="Apartment, suite (optional)" autoComplete="address-line2" />
      <div className="grid grid-cols-2 gap-4">
        <Field name="city" label="City" autoComplete="address-level2" required />
        <label className="text-ink block text-sm">
          State
          <select
            name="state"
            required
            autoComplete="address-level1"
            className={input}
            defaultValue=""
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
        <Field name="zipCode" label="ZIP code" autoComplete="postal-code" required />
        <Field name="phone" label="Phone (optional)" type="tel" autoComplete="tel" />
      </div>
      <label className="text-ink block text-sm">
        Promo code (optional)
        <input name="promoCode" defaultValue={savedPromo ?? ''} className={input} />
      </label>
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="bg-brand text-canvas min-h-11 rounded-sm px-4 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Checking your bag…' : 'Continue to payment'}
      </button>
      <p className="text-ink-muted text-xs">
        US addresses only. You will see the total and delivery window before paying.
      </p>
    </form>
  );
}
