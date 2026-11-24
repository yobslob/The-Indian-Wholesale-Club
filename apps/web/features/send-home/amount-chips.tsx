'use client';

import { useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.card;
const whole = (cents: number): string => (cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents));
export const chip = 'font-ui grid place-items-center rounded-[12px] border text-[14px] font-semibold leading-none';
export const picked = 'border-brand bg-canvas border-[1.5px] text-ink';
export const unpicked = 'border-line bg-paper text-ink';

/**
 * plan §4.1: the round-up first (1.5× wide, with "round up to $89" written under it), then $9 and $19, then Other (a
 * number field, $1 up to the cap). Every chip's main text is a plain amount, so none reads differently.
 */
export function AmountChips({
  chips,
  cents,
  roundUpCents,
  roundUpTotalCents,
  maxCents,
  onPick,
}: {
  chips: number[];
  cents: number;
  roundUpCents: number;
  roundUpTotalCents: number;
  maxCents: number;
  onPick: (cents: number) => void;
}): React.JSX.Element {
  const other = !chips.includes(cents);
  const [typing, setTyping] = useState(other);
  return (
    <div>
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-1.5" role="radiogroup" aria-label="Gift amount">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={c === cents && !typing}
            onClick={() => {
              setTyping(false);
              onPick(c);
            }}
            className={`${chip} h-11 ${c === cents && !typing ? picked : unpicked}`}
          >
            <span className="grid justify-items-center gap-0.5">
              {whole(c)}
              {c === roundUpCents ? (
                <span className="font-hand text-caution text-[14px] font-semibold leading-none">
                  {W.roundUp(whole(roundUpTotalCents))}
                </span>
              ) : null}
            </span>
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={typing || other}
          onClick={() => setTyping(true)}
          className={`${chip} h-11 ${typing || other ? picked : unpicked}`}
        >
          {other && !typing ? whole(cents) : W.other}
        </button>
      </div>
      {typing ? (
        <label className="font-ui text-ink-muted mt-2 flex items-center gap-2 text-[12.5px]">
          {W.otherLabel}
          <span className="border-line bg-paper flex h-10 items-center rounded-[10px] border px-2.5">
            $
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxCents / 100}
              step={1}
              defaultValue={other ? cents / 100 : ''}
              autoFocus
              aria-label={W.otherLabel}
              className="text-ink w-16 bg-transparent px-1 text-[15px] outline-none"
              onChange={(e) => {
                const dollars = Math.floor(Number(e.target.value));
                if (dollars >= 1 && dollars * 100 <= maxCents) onPick(dollars * 100);
              }}
            />
          </span>
        </label>
      ) : null}
    </div>
  );
}

/** The gold thread between "$4" and "₹368" (plan §4: a 48 px dashed arc that sews itself), decoration only. */
export function Thread(): React.JSX.Element {
  return (
    <svg viewBox="0 0 52 20" width="48" height="18" aria-hidden="true" className="text-gift-thread shrink-0">
      <path d="M2 15 C 14 2, 34 2, 46 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="gift-sew" />
      <path d="M41 9 L47 14 L40 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
