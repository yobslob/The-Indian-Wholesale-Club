'use client';

import { useState } from 'react';

import { SIZE_PRESETS, t, type Language } from '@repo/shared/vendor';

import { Icon } from './icons';

export type Details = {
  sizes: { label: string; qty: number }[];
  price: string;
  fabric: string;
  care: string;
  colour: string;
  note: string;
};

const field = 'border-line bg-paper text-ink min-h-12 w-full rounded-[12px] border px-3 text-[17px]';

/**
 * The last step: sizes with how many pieces of each (tap a size, then + / −), the shop's price for one piece in ₹,
 * and the optional words, folded away (D-103: one job per screen, big targets).
 */
export function DetailsStep({
  lang,
  value,
  onChange,
}: {
  lang: Language;
  value: Details;
  onChange: (next: Details) => void;
}): React.JSX.Element {
  const [custom, setCustom] = useState('');
  const set = (patch: Partial<Details>): void => onChange({ ...value, ...patch });
  const has = (label: string): boolean => value.sizes.some((s) => s.label === label);
  const toggle = (label: string): void =>
    set({ sizes: has(label) ? value.sizes.filter((s) => s.label !== label) : [...value.sizes, { label, qty: 1 }] });
  const qty = (label: string, delta: number): void =>
    set({ sizes: value.sizes.map((s) => (s.label === label ? { ...s, qty: Math.min(999, Math.max(1, s.qty + delta)) } : s)) });

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading mb-3 text-[22px] font-semibold">{t(lang, 'sizes')}</h2>
        <div className="flex flex-wrap gap-2">
          {SIZE_PRESETS.map((label) => (
            <button key={label} type="button" aria-pressed={has(label)} onClick={() => toggle(label)}
              className={`min-h-12 min-w-14 rounded-[12px] border px-3 text-[16px] font-semibold ${has(label) ? 'border-brand bg-brand text-on-brand' : 'border-line bg-paper'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t(lang, 'size_label')} maxLength={60} className={field} />
          <button type="button" onClick={() => { if (custom.trim() && !has(custom.trim())) toggle(custom.trim()); setCustom(''); }}
            className="border-line bg-paper inline-flex min-h-12 min-w-12 items-center justify-center rounded-[12px] border" aria-label={t(lang, 'add_size')}>
            <Icon name="plus" />
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {value.sizes.map((s) => (
            <li key={s.label} className="border-line bg-paper flex items-center justify-between rounded-[12px] border px-3 py-1.5">
              <span className="text-[17px] font-semibold">{s.label}</span>
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => qty(s.label, -1)} className="border-line inline-flex h-11 w-11 items-center justify-center rounded-full border" aria-label="−"><Icon name="minus" /></button>
                <span className="min-w-14 text-center text-[17px] tabular-nums">{s.qty} {t(lang, 'pieces')}</span>
                <button type="button" onClick={() => qty(s.label, 1)} className="border-line inline-flex h-11 w-11 items-center justify-center rounded-full border" aria-label="+"><Icon name="plus" /></button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <label className="block">
        <span className="font-heading mb-2 block text-[18px] font-semibold">{t(lang, 'price')}</span>
        <input inputMode="numeric" pattern="[0-9]*" value={value.price} onChange={(e) => set({ price: e.target.value.replace(/[^0-9]/g, '') })} className={`${field} text-[22px] font-semibold`} placeholder="₹" />
      </label>
      <details className="border-line bg-paper rounded-[14px] border p-3">
        <summary className="min-h-10 cursor-pointer text-[15px] font-semibold">
          {t(lang, 'fabric')} · {t(lang, 'care')} · {t(lang, 'colour')} <span className="text-ink-muted font-normal">({t(lang, 'optional')})</span>
        </summary>
        <div className="mt-3 space-y-3">
          {(['fabric', 'care', 'colour', 'note'] as const).map((key) => (
            <label key={key} className="block">
              <span className="text-ink-muted mb-1 block text-[14px]">{t(lang, key)}</span>
              <input value={value[key]} onChange={(e) => set({ [key]: e.target.value })} maxLength={500} className={field} />
            </label>
          ))}
        </div>
      </details>
    </section>
  );
}
