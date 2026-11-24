'use client';

import { useState } from 'react';

import { anyPhone, formatUsPhone } from '@repo/shared/domain';

import { useMoney } from '@/features/shell/market';

import { field, input, note, primary } from './step';

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
 * Step 1 (D-087): the phone number, +1 with the US flag in the US; required, for delivery only, no code sent. D-208:
 * abroad, a number with its country code (+44 …); a US number is still taken anywhere.
 */
export function PhoneStep({ value, onDone }: { value: string | null; onDone: (digits: string) => void }): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const { market } = useMoney();
  const abroad = market !== 'us' || (value?.startsWith('+') ?? false);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const digits = anyPhone(String(new FormData(e.currentTarget).get('phone') ?? ''));
        if (!digits) {
          setError(abroad ? 'Enter your phone number with its country code, like +44 20 7946 0958.' : 'Enter a 10-digit US phone number.');
          return;
        }
        setError(null);
        onDone(digits);
      }}
    >
      <label className={field}>
        Phone number
        {abroad ? (
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={value ? (value.startsWith('+') ? value : formatUsPhone(value)) : undefined}
            placeholder="+44 20 7946 0958"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'phone-error' : undefined}
            className={input}
          />
        ) : (
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
        )}
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
