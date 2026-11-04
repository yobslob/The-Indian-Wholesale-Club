'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
  refundTestPaymentAction,
  startTestPaymentAction,
} from '@/features/admin/actions/payment-test';
import { button } from '@/features/admin/styles';
import { PaymentForm } from '@/features/checkout/payment-form';

const PAGE = '/admin/settings/payment-test';

/** Start a $1 payment, pay it with the store's own card form, then show the result from Stripe (page.tsx). */
export function TestPayment(): React.JSX.Element {
  const router = useRouter();
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (secret)
    return (
      <PaymentForm
        clientSecret={secret}
        totalLabel="$1.00"
        // a card that needs 3-D Secure comes back here with ?payment_intent=…
        returnPath={PAGE}
        // as checkout: a US store, so the form starts on the US, not the visitor's location
        billing={{ address: { country: 'US' } }}
        onPaid={(id) => router.replace(`${PAGE}?payment_intent=${id}`)}
      />
    );

  return (
    <div className="space-y-2">
      <button
        type="button"
        className={button}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const started = await startTestPaymentAction();
            if (started.ok) setSecret(started.clientSecret);
            else setError(started.error);
          })
        }
      >
        {pending ? 'Starting…' : 'Make a $1 test payment'}
      </button>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RefundTestPayment({
  paymentIntentId,
}: {
  paymentIntentId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={button}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const done = await refundTestPaymentAction(paymentIntentId);
            if (done.ok) router.refresh();
            else setError(done.error ?? 'The refund failed.');
          })
        }
      >
        {pending ? 'Refunding…' : 'Refund this $1'}
      </button>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
