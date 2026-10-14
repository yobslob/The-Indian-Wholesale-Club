/**
 * The profit check in Settings (D-119): sample bags priced with the settings on the form, and what is left after
 * every real cost, the same model as the pricing tuner the founder signed off. Admin only; pure.
 *
 * Real costs of a bag: each piece's shop price with 3% drift and its shop fee, the courier on the billed weight
 * (rate card, rounded up to 0.5 kg, at least 1 kg), the parcel's fixed costs, US duty on what the customer pays for
 * the goods, the card fee (+ 30¢) and a 2% returns allowance, all at the day's rate (no safety buffer).
 */
import { bulkSavingCents, type BulkSaving } from './checkout';
import { autoPrice, type PricingSettings } from './pricing';

import type { ProductType } from './product-types';

/** One sample piece: shop ₹ (rupees), weight in grams, type. */
export type SamplePiece = readonly [rupees: number, grams: number, type: ProductType];

export interface SampleBag {
  name: string;
  note: string;
  pieces: readonly SamplePiece[];
}

const rep = (n: number, p: SamplePiece): SamplePiece[] => Array.from({ length: n }, () => p);

/** The tuner's bags: small, at the line, heavy and big-ticket, so a change shows where it bites. */
export const SAMPLE_BAGS: readonly SampleBag[] = [
  { name: '1 kurta', note: 'small bag', pieces: [[1299, 450, 'clothing']] },
  { name: '2 snacks', note: 'small bag', pieces: rep(2, [180, 250, 'food']) },
  {
    name: '4 kurtas',
    note: 'near the line',
    pieces: [...rep(3, [1299, 450, 'clothing']), [1599, 450, 'clothing']],
  },
  {
    name: 'Saree + lehenga',
    note: 'big ticket',
    pieces: [
      [7500, 900, 'clothing'],
      [12000, 2500, 'clothing'],
    ],
  },
  {
    name: 'Pantry, 20 pieces',
    note: 'food at the line',
    pieces: [
      ...rep(6, [120, 200, 'food']),
      ...rep(6, [250, 400, 'food']),
      ...rep(6, [90, 100, 'food']),
      ...rep(2, [350, 500, 'food']),
    ],
  },
  {
    name: 'Masala packets only',
    note: '60 × 100 g, past the line (D-120)',
    pieces: rep(60, [90, 100, 'food']),
  },
  {
    name: 'Masalas + a kurta',
    note: '12 packets + 2 kurtas',
    pieces: [...rep(12, [90, 100, 'food']), ...rep(2, [1299, 450, 'clothing'])],
  },
  {
    name: 'Namkeen + pickles',
    note: '16 pieces',
    pieces: [...rep(8, [220, 400, 'food']), ...rep(8, [300, 500, 'food'])],
  },
  {
    name: 'Staples',
    note: '6 × 2 kg sattu + 4 spices',
    pieces: [...rep(6, [380, 2000, 'food']), ...rep(4, [150, 250, 'food'])],
  },
  {
    name: 'Brass decor',
    note: '3 pieces',
    pieces: [
      [1800, 1200, 'home'],
      [900, 600, 'home'],
      [650, 400, 'home'],
    ],
  },
  {
    name: 'Wedding haul',
    note: 'lehenga + 2 sarees + 4 suits',
    pieces: [
      [12000, 2500, 'clothing'],
      ...rep(2, [7500, 900, 'clothing']),
      ...rep(4, [2499, 900, 'clothing']),
    ],
  },
];

/** The shop's fee per piece for clothing and home (food's is a setting); the tuner's estimates. */
const SHOP_FEE_PAISE: Record<ProductType, number> = { clothing: 4000, home: 6000, food: 0 };

export interface SampleBagCharges {
  freeMinCents: number | null;
  shippingCents: number;
  retailerCents: number;
  bulk: BulkSaving | null;
}

export interface BagResult {
  name: string;
  note: string;
  billedKg: number;
  goodsCents: number;
  chargesCents: number;
  bulkSavingCents: number;
  paysCents: number;
  profitCents: number;
}

/** A sample bag priced and costed; null while a piece cannot be priced (a setting missing). */
export function checkBag(
  bag: SampleBag,
  s: PricingSettings,
  charges: SampleBagCharges,
): BagResult | null {
  const prices: number[] = [];
  for (const [rupees, grams, type] of bag.pieces) {
    const p = autoPrice(
      { shopPricePaise: Math.round(rupees * 100), weightG: grams, productType: type },
      s,
    );
    if (!p) return null;
    prices.push(p.priceCents);
  }
  const fx = s.fxInrPerUsd!;
  const goods = prices.reduce((a, b) => a + b, 0);
  const small = charges.freeMinCents !== null && goods < charges.freeMinCents;
  const chargesCents = small ? charges.shippingCents + charges.retailerCents : 0;
  const saving = bulkSavingCents(goods, charges.freeMinCents, charges.bulk);
  const pays = goods + chargesCents - saving;

  let indiaPaise = 0;
  let kg = 0;
  let dutyCents = 0;
  bag.pieces.forEach(([rupees, grams, type], i) => {
    indiaPaise +=
      rupees * 100 * 1.03 + (type === 'food' ? (s.foodFeePaise ?? 0) : SHOP_FEE_PAISE[type]);
    kg += (grams * (type === 'food' ? (s.foodBilledPct ?? 100) : 100)) / 100 / 1000;
    dutyCents += ((prices[i]! * (goods - saving)) / goods) * ((s.dutyPct?.[type] ?? 0) / 100);
  });
  const billedKg = Math.max(1, Math.ceil(kg * 2) / 2);
  const courierPaise = (s.courierFirstKgPaise ?? 0) + (billedKg - 1) * (s.courierNextKgPaise ?? 0);
  const cost =
    (indiaPaise + courierPaise + (s.parcelFixedPaise ?? 0)) / fx +
    dutyCents +
    (pays * (s.guardCardFeePct ?? 0)) / 100 +
    30 +
    pays * 0.02;
  return {
    name: bag.name,
    note: bag.note,
    billedKg,
    goodsCents: goods,
    chargesCents,
    bulkSavingCents: saving,
    paysCents: pays,
    profitCents: Math.round(pays - cost),
  };
}
