'use client';

import { useActionState } from 'react';

import { lookupOrderAction, type LookupState } from './actions';
import { OrderView } from './order-view';

const initial: LookupState = { order: null, error: null };

/** Order number + email → the order (guest tracking), in a centred card (D-088). */
export function LookupForm({
  title,
  defaultNumber,
}: {
  title: string;
  defaultNumber?: string;
}): React.JSX.Element {
  const [state, action, pending] = useActionState(lookupOrderAction, initial);
  if (state.order) return <OrderView order={state.order} />;
  return (
    <div className="grid place-items-center py-[clamp(16px,4vw,64px)]">
      <form
        action={action}
        className="bg-surface grid w-full max-w-[460px] gap-4 rounded-lg p-[clamp(24px,3vw,36px)]"
      >
        <h1 className="font-heading mb-1 text-[clamp(28px,2.6vw,40px)] font-medium leading-tight tracking-[-0.02em] text-[#1D1A17]">
          {title}
        </h1>
        <label className="font-ui text-ink block text-[13px] font-medium">
          Order number
          <input
            name="orderNumber"
            required
            defaultValue={defaultNumber}
            placeholder="IWC-260928-…"
            className="border-line bg-paper focus:border-ink min-h-12 w-full rounded-md border px-3.5 text-[15px] outline-none"
          />
        </label>
        <label className="font-ui text-ink block text-[13px] font-medium">
          Email used for the order
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="border-line bg-paper focus:border-ink min-h-12 w-full rounded-md border px-3.5 text-[15px] outline-none"
          />
        </label>
        {state.error ? (
          <p className="text-danger text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="bg-brand text-on-brand font-ui rounded-pill mt-1.5 h-[52px] w-full px-6 text-base font-semibold disabled:opacity-50"
        >
          {pending ? 'Looking…' : 'Find my order'}
        </button>
        <p className="text-ink-muted m-0 text-center text-[13px]">
          Both are in your order confirmation email.
        </p>
      </form>
    </div>
  );
}
