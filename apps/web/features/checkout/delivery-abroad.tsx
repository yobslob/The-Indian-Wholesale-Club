'use client';

import { useCountries } from '@/features/shell/countries';

import { field, input, note, primary } from './step';

import type { Delivery } from './delivery-step';

/** D-208: the country an order goes to, from the countries IWC sells in (the visitor's to start with). */
export function CountryField({ value, onChange }: { value: string; onChange: (code: string) => void }): React.JSX.Element {
  const countries = useCountries();
  const list = countries.some((c) => c.code === value) ? countries : [...countries, { code: value, name: value.toUpperCase() }];
  return (
    <label className={field}>
      Country
      <select name="country" autoComplete="country" value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {list.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * D-208, step 2 for an address outside the US: name, email, street, apartment, city, region (optional: not every country
 * has one) and postal code, typed as the country writes them; the server checks the country is one IWC sells in and
 * prices the bag there (its freight; no US sales tax). Delivery days are the same as the US's (D-209).
 */
export function DeliveryAbroad({
  value,
  country,
  onCountry,
  busy,
  error,
  onDone,
}: {
  value: Delivery;
  country: string;
  onCountry: (code: string) => void;
  busy: boolean;
  error: string | null;
  onDone: (d: Delivery) => void;
}): React.JSX.Element {
  const same = value.country === country;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const text = (k: string): string => String(f.get(k) ?? '').trim();
        onDone({
          fullName: text('fullName'),
          email: text('email'),
          zipCode: text('zipCode'),
          city: text('city'),
          state: text('state'),
          line1: text('line1'),
          line2: text('line2'),
          country,
        });
      }}
    >
      <CountryField value={country} onChange={onCountry} />
      <label className={field}>
        Full name
        <input name="fullName" autoComplete="name" required defaultValue={value.fullName} className={input} />
      </label>
      <label className={field}>
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={value.email} className={input} />
      </label>
      <label className={field}>
        Street address
        <input name="line1" autoComplete="address-line1" required minLength={3} defaultValue={same ? value.line1 : ''} className={input} />
      </label>
      <label className={field}>
        Apartment, suite (optional)
        <input name="line2" autoComplete="address-line2" defaultValue={same ? value.line2 : ''} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-x-3.5">
        <label className={field}>
          City
          <input name="city" autoComplete="address-level2" required minLength={2} defaultValue={same ? value.city : ''} className={input} />
        </label>
        <label className={field}>
          Postal code
          <input
            name="zipCode"
            autoComplete="postal-code"
            required
            maxLength={12}
            pattern="[A-Za-z0-9][A-Za-z0-9 \-]{1,11}"
            defaultValue={same ? value.zipCode : ''}
            className={input}
          />
        </label>
      </div>
      <label className={field}>
        State, province or region (optional)
        <input name="state" autoComplete="address-level1" maxLength={60} defaultValue={same ? value.state : ''} className={input} />
      </label>
      {error ? (
        <p className="text-danger mb-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`${primary} w-full`}>
        {busy ? 'Checking your bag…' : 'Continue to payment'}
      </button>
      <p className={note}>You will see the total and delivery window before paying, in US dollars.</p>
    </form>
  );
}
