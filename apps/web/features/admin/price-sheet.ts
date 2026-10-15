/**
 * Products → Download Excel (D-128): the founder's six columns, one row per product. Margin is the share of the US
 * price left after the subtotal (shop ₹ ÷ 0.90 + weight g × ₹2), at the beta's ₹92: 20% food, 40% clothing, 50% home
 * & gifts for every automatic price (within a cent's rounding); a hand-set price shows its own margin. Pure.
 */
import { BETA_PRICING, betaSubtotalInr } from '@repo/shared/domain';

import type { XlsxCell, XlsxColumn } from './xlsx';

export interface PriceSheetSource {
  name: string;
  product_type: 'clothing' | 'food' | 'home';
  shop_price_paise: number | null;
  weight_g: number | null;
  price_cents: number;
}

/** The founder's category names (D-128). */
export const SHEET_CATEGORY: Record<PriceSheetSource['product_type'], string> = {
  food: 'Food & Beverages',
  clothing: 'Clothing & Fashion',
  home: 'Home Decor',
};

export const PRICE_SHEET_COLUMNS: readonly XlsxColumn[] = [
  { header: 'Name', width: 44 },
  { header: 'Indian price (₹)', format: '"₹"#,##0.00', width: 16 },
  { header: 'Category', width: 20 },
  { header: 'Weight (g)', format: '#,##0" g"', width: 12 },
  { header: 'US price ($)', format: '"$"#,##0.00', width: 13 },
  { header: 'Margin', format: '0.0%', width: 10 },
];

/** A product's margin of its US price, as a fraction; null without a shop price, weight or price. */
export function sheetMargin(p: PriceSheetSource): number | null {
  if (p.shop_price_paise === null || p.weight_g === null || p.price_cents <= 0) return null;
  const priceInr = (p.price_cents / 100) * BETA_PRICING.inrPerUsd;
  return 1 - betaSubtotalInr(p.shop_price_paise, p.weight_g) / priceInr;
}

export function priceSheetRows(products: readonly PriceSheetSource[]): XlsxCell[][] {
  return products.map((p) => [
    p.name,
    p.shop_price_paise === null ? null : p.shop_price_paise / 100,
    SHEET_CATEGORY[p.product_type],
    p.weight_g,
    p.price_cents / 100,
    sheetMargin(p),
  ]);
}
