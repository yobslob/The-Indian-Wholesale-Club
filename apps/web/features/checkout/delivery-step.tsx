'use client';

import { useEffect, useState } from 'react';

import { US_STATES } from '@repo/shared/domain';

import { field, input, note, primary } from './step';

export interface Delivery {
  fullName: string;
  email: string;
  zipCode: string;
  city: string;
  state: string;
  line1: string;
  line2: string;
  promoCode: string;
}

type Lookup =
  { kind: 'idle' } | { kind: 'found'; city: string; state: string } | { kind: 'unknown' };

/** One line for the folded step: "Meera Nair · 12 Oak St, Edison, NJ 08817". */
export function deliverySummary(d: Delivery): string {
  return `${d.fullName} · ${d.line1}${d.line2 ? ` ${d.line2}` : ''}, ${d.city}, ${d.state} ${d.zipCode}`;
}

/**
 * Step 2 (D-087): name, email (confirmations and guest tracking), the ZIP code with the city and state filled in from
 * our own list (D-098, /api/zip; editable, and an unknown ZIP asks for them), street, apartment and the promo code
 * behind "Add a promo code". Continue to payment hands the details up; the parent prices the bag on the server.
 */
export function DeliveryStep({
  value,
  busy,
  error,
  onDone,
}: {
  value: Delivery;
  busy: boolean;
  error: string | null;
  onDone: (d: Delivery) => void;
}): React.JSX.Element {
  const [zip, setZip] = useState(value.zipCode);
  const [city, setCity] = useState(value.city);
  const [state, setState] = useState(value.state);
  const [lookup, setLookup] = useState<Lookup>(
    value.city ? { kind: 'found', city: value.city, state: value.state } : { kind: 'idle' },
  );
  const [editPlace, setEditPlace] = useState(false);
  const [promo, setPromo] = useState(Boolean(value.promoCode));

  useEffect(() => {
    if (!/^\d{5}$/.test(zip) || (zip === value.zipCode && value.city)) return;
    let gone = false;
    void fetch(`/api/zip?zip=${zip}`)
      .then(async (res) =>
        res.ok ? ((await res.json()) as { city: string; state: string }) : null,
      )
      .catch(() => null)
      .then((hit) => {
        if (gone) return;
        if (hit) {
          setCity(hit.city);
          setState(hit.state);
          setLookup({ kind: 'found', ...hit });
        } else {
          setLookup({ kind: 'unknown' });
        }
      });
    return () => {
      gone = true;
    };
  }, [zip, value.zipCode, value.city]);

  const askPlace = editPlace || lookup.kind === 'unknown';
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // The lookup has not answered (or found nothing): ask for the city and state.
        if (!city.trim() || !state) {
          setEditPlace(true);
          return;
        }
        const f = new FormData(e.currentTarget);
        const text = (k: string): string => String(f.get(k) ?? '').trim();
        onDone({
          fullName: text('fullName'),
          email: text('email'),
          zipCode: zip,
          city: city.trim(),
          state,
          line1: text('line1'),
          line2: text('line2'),
          promoCode: text('promoCode'),
        });
      }}
    >
      <label className={field}>
        Full name
        <input
          name="fullName"
          autoComplete="name"
          required
          defaultValue={value.fullName}
          className={input}
        />
      </label>
      <label className={field}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={value.email}
          className={input}
        />
      </label>
      <div className="grid grid-cols-2 gap-x-3.5">
        <label className={field}>
          ZIP code
          <input
            name="zipCode"
            inputMode="numeric"
            autoComplete="postal-code"
            required
            pattern="\d{5}"
            maxLength={5}
            value={zip}
            onChange={(e) => {
              setZip(e.target.value.replace(/\D/g, '').slice(0, 5));
              setLookup({ kind: 'idle' });
              setEditPlace(false);
            }}
            className={input}
          />
        </label>
      </div>
      <p className="font-ui -mt-1.5 mb-3.5 min-h-5 text-sm font-medium" aria-live="polite">
        {lookup.kind === 'found' && !editPlace ? (
          <span className="text-positive">
            ✓ {lookup.city}, {lookup.state}
            <button
              type="button"
              onClick={() => setEditPlace(true)}
              className="border-line bg-paper text-ink rounded-pill ml-2.5 border px-2.5 py-1 text-[13px]"
            >
              Edit
            </button>
          </span>
        ) : lookup.kind === 'unknown' ? (
          <span className="text-ink-muted font-normal">
            We could not find that ZIP; type the city and state.
          </span>
        ) : null}
      </p>
      {/* Filled from the ZIP; fields only when the customer needs to type them. */}
      {askPlace ? (
        <div className="grid grid-cols-2 gap-x-3.5">
          <label className={field}>
            City
            <input
              name="city"
              autoComplete="address-level2"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={input}
            />
          </label>
          <label className={field}>
            State
            <select
              name="state"
              autoComplete="address-level1"
              required
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={input}
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
      ) : null}
      <label className={field}>
        Street address
        <input
          name="line1"
          autoComplete="address-line1"
          required
          defaultValue={value.line1}
          className={input}
        />
      </label>
      <label className={field}>
        Apartment, suite (optional)
        <input
          name="line2"
          autoComplete="address-line2"
          defaultValue={value.line2}
          className={input}
        />
      </label>
      {promo ? (
        <label className={field}>
          Promo code
          <input name="promoCode" defaultValue={value.promoCode} className={input} />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setPromo(true)}
          className="font-ui mb-4 text-sm font-medium underline underline-offset-[3px]"
        >
          Add a promo code
        </button>
      )}
      {error ? (
        <p className="text-danger mb-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`${primary} w-full`}>
        {busy ? 'Checking your bag…' : 'Continue to payment'}
      </button>
      <p className={note}>
        US addresses only. You will see the total and delivery window before paying.
      </p>
    </form>
  );
}
