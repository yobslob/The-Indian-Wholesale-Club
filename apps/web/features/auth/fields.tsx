'use client';

import { useRef, useState } from 'react';

export const field = 'font-ui mb-3.5 block text-[13px] font-medium';
export const input =
  'border-line bg-paper focus:border-ink mt-1.5 block min-h-12 w-full rounded-md border px-3.5 text-[15px] font-normal outline-none';
export const primary =
  'bg-brand text-on-brand font-ui grid h-[52px] w-full place-items-center rounded-pill text-base font-semibold disabled:opacity-50';
export const secondary =
  'border-line bg-paper font-ui mt-2.5 grid h-12 w-full place-items-center rounded-pill border text-[15px] font-semibold disabled:opacity-50';
export const linkButton = 'font-semibold text-black underline underline-offset-[3px]';

/** A password with an eye that shows or hides it (D-091). */
export function PasswordField({
  label,
  name,
  autoComplete,
}: {
  label: string;
  name: string;
  autoComplete: 'current-password' | 'new-password';
}): React.JSX.Element {
  const [shown, setShown] = useState(false);
  return (
    <label className={field}>
      {label}
      <span className="relative mt-1.5 block">
        <input
          name={name}
          type={shown ? 'text' : 'password'}
          required
          minLength={8}
          autoComplete={autoComplete}
          className={`${input} mt-0 pr-[52px]`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="text-ink-muted absolute right-1 top-1 grid size-10 place-items-center rounded-full"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {shown ? (
              <path d="M3 3l18 18M10.6 5.1A10.5 10.5 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.4M9.9 9.9a3 3 0 0 0 4.2 4.2" />
            ) : (
              <>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
        </button>
      </span>
    </label>
  );
}

export function EmailField({ value }: { value?: string }): React.JSX.Element {
  return (
    <label className={field}>
      Email
      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={value}
        className={input}
      />
    </label>
  );
}

/**
 * Six boxes for the emailed code (D-091): typing moves on, Backspace moves back, and pasting the whole code (or the
 * phone's one-time-code suggestion) fills all six. `onChange` gets the digits typed so far.
 */
export function CodeBoxes({ onChange }: { onChange: (code: string) => void }): React.JSX.Element {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const read = (): string => boxes.current.map((b) => b?.value ?? '').join('');
  const fill = (from: number, digits: string): void => {
    digits.split('').forEach((d, i) => {
      const box = boxes.current[from + i];
      if (box) box.value = d;
    });
    boxes.current[Math.min(from + digits.length, 5)]?.focus();
    onChange(read());
  };
  return (
    <div className="mb-4 grid grid-cols-6 gap-2" role="group" aria-label="6-digit code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={i === 0 ? 6 : 1}
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          className="border-line bg-paper focus:border-ink font-ui h-14 w-full rounded-md border text-center text-[22px] font-semibold outline-none"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            e.target.value = '';
            if (digits) fill(i, digits.slice(0, 6 - i));
            else onChange(read());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !e.currentTarget.value) {
              const prev = boxes.current[i - 1];
              if (prev) {
                prev.value = '';
                prev.focus();
                onChange(read());
                e.preventDefault();
              }
            }
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            if (!digits) return;
            e.preventDefault();
            fill(0, digits);
          }}
        />
      ))}
    </div>
  );
}

export function Check(): React.JSX.Element {
  return (
    <span
      className="text-positive mb-3.5 grid size-12 place-items-center rounded-full bg-[rgb(22_101_52/0.12)]"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </span>
  );
}
