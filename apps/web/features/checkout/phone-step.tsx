'use client';

import { useState } from 'react';

import { field, input, note, primary } from './step';

/** A US number as ten digits (an optional leading 1 dropped), or null. Area codes never start with 0 or 1. */
export function usPhoneDigits(text: string): string | null {
  const digits = text.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return /^[2-9]\d{9}$/.test(digits) ? digits : null;
}

/** +1 (732) 555-0142 */
export function formatUsPhone(digits: string): string {
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function UsFlag(): React.JSX.Element {
  return (
    <svg viewBox="0 0 19 10" width="22" height="12" aria-hidden="true" className="block rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
      <rect width="19" height="10" fill="#b22234" />
      {[0.769, 2.307, 3.845, 5.383, 6.921, 8.459].map((y) => (
        <rect key={y} y={y} width="19" height="0.769" fill="#fff" />
      ))}
      <rect width="7.6" height="5.385" fill="#3c3b6e" />
    </svg>
  );
}

/**
 * Step 1 (D-087): the phone number, +1 with the US flag; required, for delivery only, no code sent. We deliver only in
 * the US, so the country is fixed.
 */
export function PhoneStep({ value, onDone }: { value: string | null; onDone: (digits: string) => void }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const digits = usPhoneDigits(String(new FormData(e.currentTarget).get('phone') ?? ''));
        if (!digits) {
          setError('Enter a 10-digit US phone number.');
          return;
        }
        setError(null);
        onDone(digits);
      }}
    >
      <label className={field}>
        Phone number
        <span className="mt-1.5 flex">
          <span className="border-line bg-surface inline-flex min-h-12 items-center gap-1.5 rounded-l-md border border-r-0 px-3 text-[15px] font-medium">
            <UsFlag />
            <span className="sr-only">United States</span>+1
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            required
            defaultValue={value ? formatUsPhone(value).slice(3) : undefined}
            placeholder="(732) 555-0142"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'phone-error' : undefined}
            className={`${input} mt-0 rounded-l-none`}
          />
        </span>
      </label>
      {error ? (
        <p id="phone-error" className="text-danger -mt-2 mb-3 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className={primary}>
        Continue
      </button>
      <p className={note}>For delivery only. We don&apos;t text you anything at checkout.</p>
    </form>
  );
}
