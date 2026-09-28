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
      <label className="text-ink block text-sm">
        Order number
        <input
          name="orderNumber"
          required
          defaultValue={defaultNumber}
          placeholder="IWC-260928-…"
          className="border-line bg-canvas min-h-11 w-full rounded-sm border px-3"
        />
      </label>
      <label className="text-ink block text-sm">
        Email used for the order
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="border-line bg-canvas min-h-11 w-full rounded-sm border px-3"
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
        className="bg-brand text-canvas min-h-11 rounded-sm px-4 text-sm font-medium disabled:opacity-50"
      >
        {pending ? 'Looking…' : 'Find my order'}
      </button>
    </form>
  );
}
