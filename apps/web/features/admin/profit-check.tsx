'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  autoPrice,
  checkBag,
  formatUsd,
  pricingSettingsFrom,
  SAMPLE_BAGS,
  type ProductType,
} from '@repo/shared/domain';

import { SETTING_FIELDS, storedValue } from './settings-fields';

type Row = Record<string, number | null>;

/** Sample pieces to read the recipes and the guard at a glance (shop ₹, g, type). */
const PIECES: [string, number, number, ProductType][] = [
  ['Snack ₹90 · 100 g', 90, 100, 'food'],
  ['Masala ₹150 · 250 g', 150, 250, 'food'],
  ['Namkeen ₹220 · 400 g', 220, 400, 'food'],
  ['Kurta ₹1,299 · 450 g', 1299, 450, 'clothing'],
  ['Saree ₹7,500 · 900 g', 7500, 900, 'clothing'],
  ['Lehenga ₹12,000 · 2.5 kg', 12000, 2500, 'clothing'],
  ['Brass diya ₹650 · 400 g', 650, 400, 'home'],
  ['Brass decor ₹1,800 · 1.2 kg', 1800, 1200, 'home'],
];

const RULE = { recipe: 'recipe', tapered: 'tapered margin', guard: 'guard' } as const;

/** The form's numbers as a settings row: what is typed, else what is saved. */
function readForm(form: HTMLFormElement, saved: Row): Row {
  const data = new FormData(form);
  const row: Row = { ...saved };
  for (const f of SETTING_FIELDS) {
    const v = storedValue(f.kind, String(data.get(f.key) ?? ''));
    row[f.key] = Number.isNaN(v) ? (saved[f.key] ?? null) : v;
  }
  return row;
}

/**
 * The profit check (D-119): sample pieces and bags priced with the numbers on the Settings form as they are typed,
 * and what each bag leaves after its real costs (the courier rate card, duty, card fee, shop fees, 3% price drift,
 * 2% returns). Nothing is saved from here; the form's Save does that.
 */
export function ProfitCheck({ formId, saved }: { formId: string; saved: Row }): React.JSX.Element {
  const [row, setRow] = useState<Row>(saved);
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setRow(readForm(form, saved)));
    };
    form.addEventListener('input', update);
    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener('input', update);
    };
  }, [formId, saved]);

  const { pieces, bags } = useMemo(() => {
    const s = pricingSettingsFrom(row);
    const price = (rupees: number, g: number, type: ProductType) => {
      try {
        return autoPrice({ shopPricePaise: rupees * 100, weightG: g, productType: type }, s);
      } catch {
        return null;
      }
    };
    const charges = {
      freeMinCents: row.free_shipping_min_cents ?? null,
      shippingCents: row.small_order_shipping_cents ?? 0,
      retailerCents: row.small_order_retailer_cents ?? 0,
      bulk: { pct: row.bulk_saving_pct ?? 0, capCents: row.bulk_saving_cap_cents ?? 0 },
    };
    return {
      pieces: PIECES.map(([label, rupees, g, type]) => ({
        label,
        type,
        p: price(rupees, g, type),
      })),
      bags: SAMPLE_BAGS.map((b) => {
        try {
          return { name: b.name, note: b.note, r: checkBag(b, s, charges) };
        } catch {
          return { name: b.name, note: b.note, r: null };
        }
      }),
    };
  }, [row]);

  const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted';
  const td = 'px-3 py-2 tabular-nums';
  return (
    <section className="space-y-4" aria-live="polite">
      <div className="space-y-1">
        <h2 className="font-heading text-[17px] font-semibold">Profit check</h2>
        <p className="text-ink-muted text-sm">
          These follow the numbers above as you type. Profit is what a bag leaves after the shop
          price (+3% drift), the shops&apos; fees, the courier on its billed weight, the box and
          clearance, US duty, the card fee and 2% for returns. Shop fees for clothing and home (₹40
          and ₹60 a piece) are estimates.
        </p>
      </div>
      <div className="border-line overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className={th}>Piece</th>
              <th className={`${th} text-right`}>Price</th>
              <th className={th}>Set by</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map(({ label, type, p }) => (
              <tr key={label} className="border-line border-t">
                <td className={td}>
                  {label}{' '}
                  <span className="text-ink-muted">
                    · {type === 'home' ? 'home & gifts' : type}
                  </span>
                </td>
                <td className={`${td} text-right font-semibold`}>
                  {p ? formatUsd(p.priceCents) : '—'}
                </td>
                <td className={`${td} text-ink-muted`}>
                  {p ? RULE[p.rule] : 'a number is missing'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-line overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className={th}>Bag</th>
              <th className={`${th} text-right`}>Billed kg</th>
              <th className={`${th} text-right`}>Customer pays</th>
              <th className={`${th} text-right`}>Profit</th>
            </tr>
          </thead>
          <tbody>
            {bags.map(({ name, note, r }) => (
              <tr key={name} className="border-line border-t">
                <td className={td}>
                  {name} <span className="text-ink-muted">· {note}</span>
                </td>
                <td className={`${td} text-right`}>{r ? r.billedKg.toFixed(1) : '—'}</td>
                <td className={`${td} text-right`}>
                  {r ? formatUsd(r.paysCents) : '—'}
                  {r && r.chargesCents > 0 ? (
                    <span className="text-ink-muted block text-xs">incl. small-order charges</span>
                  ) : null}
                  {r && r.bulkSavingCents > 0 ? (
                    <span className="text-ink-muted block text-xs">
                      after −{formatUsd(r.bulkSavingCents)} bulk saving
                    </span>
                  ) : null}
                </td>
                <td
                  className={`${td} text-right font-semibold ${r && r.profitCents < 0 ? 'text-danger' : 'text-positive'}`}
                >
                  {r
                    ? `${formatUsd(r.profitCents)} · ${((r.profitCents / r.paysCents) * 100).toFixed(1)}%`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
