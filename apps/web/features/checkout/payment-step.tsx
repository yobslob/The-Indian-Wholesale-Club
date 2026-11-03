'use client';

import Link from 'next/link';
import { useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { PaymentForm } from './payment-form';
import { ShippingPicker } from './shipping-picker';

import type { Delivery } from './delivery-step';
import type { CheckoutRequestBody } from './types';
import type { useCheckoutPayment } from './use-checkout-payment';

/**
 * Step 3 of /checkout: shipping, the card form and Pay. A re-price that failed shows its message with Try again and
 * keeps Pay off until the total is the one the payment holds (launch QA A-3, A-5); while the card is being charged
 * the shipping can't change. An order refused after payment (sold out meanwhile, refunded) replaces the form.
 */
export function PaymentStep({
  payment,
  delivery,
  phone,
  notice,
  onPrice,
}: {
  payment: ReturnType<typeof useCheckoutPayment>;
  delivery: Delivery;
  phone: string | null;
  notice: string | null;
  onPrice: (body: CheckoutRequestBody) => void;
}): React.JSX.Element | null {
  const [paying, setPaying] = useState(false);
  const { started, request, busy, error } = payment;

  if (payment.refused) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-danger text-sm">{payment.refused}</p>
        <Link href="/cart" className="font-ui text-sm underline">
          Back to your bag
        </Link>
      </div>
    );
  }
  if (!started || !request) return null;
  return (
    <>
      <ShippingPicker
        quote={started.quote}
        disabled={busy || paying}
        onChange={(method) => onPrice({ ...request, shippingMethod: method })}
      />
      {error ? (
        <div className="mb-3 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-danger text-sm">{error}</p>
          {payment.stale ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPrice(request)}
              className="border-line font-ui rounded-pill min-h-11 border px-5 text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Try again'}
            </button>
          ) : null}
        </div>
      ) : null}
      <PaymentForm
        key={started.clientSecret}
        clientSecret={started.clientSecret}
        totalLabel={formatUsd(started.quote.breakdown.totalCents)}
        amountCents={started.quote.breakdown.totalCents}
        disabled={busy || payment.stale}
        notice={notice}
        onPaying={setPaying}
        onPaid={(id, status) => void payment.paid(id, status)}
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
  );
}
