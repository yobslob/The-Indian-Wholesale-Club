'use client';

import { useState, useTransition } from 'react';

import { unmarkOrderedAction } from '../actions/shop-orders';

/** "Not ordered after all": puts a piece back on To order (a wrong Mark ordered), with a line if it can't (D-140). */
export function UnorderButton({ pickupId, orderId }: { pickupId: string; orderId: string }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="text-[12.5px]">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await unmarkOrderedAction(pickupId, orderId);
            setError(result.ok ? null : result.error);
          })
        }
        className="min-h-11 underline md:min-h-0"
      >
        Not ordered after all
      </button>
      {error ? <span className="text-danger block">{error}</span> : null}
    </span>
  );
}
