'use client';

import { useState, useTransition } from 'react';

import { WEARS, WEARS_LABEL, type Wears } from '@repo/shared/domain';

import { setWearsAction } from './actions/catalog';

/**
 * Who a clothing piece is for, right in the Products list (D-140, F2): the choice shows at once and saves after; it
 * goes back with a line if the server refuses (rule 0.1). Sorting the listings no rule could read is one tap each.
 */
export function WearsPicker({ productId, wears }: { productId: string; wears: Wears | null }): React.JSX.Element {
  const [value, setValue] = useState<Wears | ''>(wears ?? '');
  const [error, setError] = useState(false);
  const [, start] = useTransition();
  return (
    <span className="block">
      <select
        aria-label="For"
        value={value}
        onChange={(e) => {
          const next = e.target.value as Wears;
          const before = value;
          setValue(next);
          setError(false);
          start(async () => {
            const ok = await setWearsAction(productId, next);
            if (!ok) {
              setValue(before);
              setError(true);
            }
          });
        }}
        className={`border-line bg-canvas h-11 rounded-[8px] border px-2 text-[13px] md:h-8 ${value ? '' : 'border-caution text-caution'}`}
      >
        {value ? null : <option value="">Not set</option>}
        {WEARS.map((w) => (
          <option key={w} value={w}>
            {WEARS_LABEL[w]}
          </option>
        ))}
      </select>
      {error ? <small className="text-danger block text-[12px]">Not saved</small> : null}
    </span>
  );
}
