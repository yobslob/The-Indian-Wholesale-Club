'use client';

import { useActionState } from 'react';

import { lookupOrderAction, type LookupState } from './actions';
import { OrderView } from './order-view';

const initial: LookupState = { order: null, error: null };

/** Order number + email → the order (guest tracking). */
export function LookupForm({ defaultNumber }: { defaultNumber?: string }): React.JSX.Element {
  const [state, action, pending] = useActionState(lookupOrderAction, initial);
  if (state.order) return <OrderView order={state.order} />;
  return (
    <form action={action} className="grid max-w-md gap-4">
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
        className="bg-brand text-on-brand font-ui min-h-12 rounded-pill px-6 text-[15px] font-medium disabled:opacity-50"
      >
        {pending ? 'Looking…' : 'Find my order'}
      </button>
    </form>
  );
}
