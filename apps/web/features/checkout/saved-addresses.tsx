'use client';

import type { SavedAddress } from './types';

/**
 * D-114: a signed-in customer's saved addresses above the delivery form, the default picked first. Picking one fills
 * the form below (still editable); "A new address" empties it. Saved addresses are managed on Profile → Addresses.
 */
export function SavedAddresses({
  addresses,
  picked,
  onPick,
}: {
  addresses: SavedAddress[];
  picked: string;
  onPick: (address: SavedAddress | null) => void;
}): React.JSX.Element | null {
  if (addresses.length === 0) return null;
  const card =
    'border-line bg-paper has-[:checked]:border-ink font-ui flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-sm';
  return (
    <fieldset className="mb-[18px] grid gap-2">
      <legend className="font-ui mb-2 text-sm font-medium">Your saved addresses</legend>
      {addresses.map((a) => (
        <label key={a.id} className={card}>
          <input
            type="radio"
            name="savedAddress"
            className="mt-1"
            checked={picked === a.id}
            onChange={() => onPick(a)}
          />
          <span className="min-w-0 flex-1">
            <b className="block font-semibold">
              {a.label ? `${a.label} · ` : ''}
              {a.fullName}
              {a.isDefault ? <span className="text-ink-muted font-normal"> · Default</span> : null}
            </b>
            <span className="text-ink-muted">
              {a.line1}
              {a.line2 ? ` ${a.line2}` : ''}, {a.city}, {a.state} {a.zipCode}
            </span>
          </span>
        </label>
      ))}
      <label className={card}>
        <input type="radio" name="savedAddress" className="mt-1" checked={picked === 'new'} onChange={() => onPick(null)} />
        <span className="font-semibold">A new address</span>
      </label>
    </fieldset>
  );
}
