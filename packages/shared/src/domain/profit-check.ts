/**
 * The profit check in Settings (D-119): sample bags priced with the settings on the form, and what is left after
 * every real cost, the same model as the pricing tuner the founder signed off. Admin only; pure.
 *
 * Real costs of a bag: each piece's shop price with 3% drift and its shop fee, the courier on the billed weight
 * (rate card, rounded up to 0.5 kg, at least 1 kg), the parcel's fixed costs, US duty on what the customer pays for
 * the goods, the card fee (+ 30¢) and a 2% returns allowance, all at the day's rate (no safety buffer).
 */
import { bagChargesAt, bulkSavingCents, type BulkSaving } from './checkout';
import { autoPrice, priceEnding, type PricingSettings } from './pricing';

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
    name: 'Bhujia, 12 × 1 kg',
    note: 'just under the line (D-124)',
    pieces: rep(12, [230, 1000, 'food']),
  },
  {
    name: 'Bhujia, 14 × 1 kg',
    note: 'just past the line: Shipping free (D-124)',
    pieces: rep(14, [230, 1000, 'food']),
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
  /** The parcel's amount: the least Shipping below the line (D-112). */
  shippingCents: number;
  retailerCents: number;
  bulk: BulkSaving | null;
  /** D-123: the retailer charges' % of the goods (at least retailerCents). */
  retailerPct?: number | null;
}

/**
 * D-125: what a bag's Shipping must bring for it not to lose, as store_bag_charges() works it out (the same numbers at
 * the effective rate): the parcel's courier (first kg, each further half kg, box and clearance) and the card's fixed
 * fee, less what the pieces leave after their shop cost, duty, the card fee and 2% returns; over what a dollar keeps.
 */
export function neededShippingCents(
  pieces: readonly SamplePiece[],
  prices: readonly number[],
  s: PricingSettings,
  bulkSavingCents = 0,
): number | null {
  const { fxInrPerUsd: fx, fxBufferPct: buffer, courierFirstKgPaise: first, courierNextKgPaise: next } = s;
  if (fx == null || buffer == null || first == null || next == null) return null;
  const rate = fx * (1 - buffer / 100);
  const keep = 1 - (s.guardCardFeePct ?? 0) / 100 - 0.02;
  let kg = 0;
  let contribution = 0;
  pieces.forEach(([rupees, grams, type], i) => {
    kg += (grams * (type === 'food' ? (s.foodBilledPct ?? 100) : 100)) / 100 / 1000;
    const fee = type === 'food' ? (s.foodFeePaise ?? 0) : SHOP_FEE_PAISE[type];
    contribution +=
      prices[i]! * (keep - (s.dutyPct?.[type] ?? 0) / 100) - (rupees * 100 * 1.03 + fee) / rate;
  });
  const billed = Math.max(Math.ceil(Math.max(kg, 1) * 2) / 2 - 1, 0);
  const courier = (first + billed * next + (s.parcelFixedPaise ?? 0)) / rate + 30;
  return (courier - contribution + bulkSavingCents) / Math.max(keep, 0.5);
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
  const saving0 = bulkSavingCents(goods, charges.freeMinCents, charges.bulk);
  // D-125: Shipping is at least the parcel's amount, more when the pieces cannot pay for the parcel; past the line
  // only what the bag still needs
  const need = neededShippingCents(bag.pieces, prices, s) ?? 0;
  const needPast = neededShippingCents(bag.pieces, prices, s, saving0) ?? 0;
  const at = bagChargesAt(goods, charges.freeMinCents, {
    shippingCents: need > charges.shippingCents ? priceEnding(need) : charges.shippingCents,
    pastLineCents: needPast > 0 ? priceEnding(needPast) : 0,
    retailerCents: charges.retailerCents,
    retailerPct: charges.retailerPct ?? null,
  });
  const chargesCents = at.shippingCents + at.retailerCents;
  const saving = saving0;
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
