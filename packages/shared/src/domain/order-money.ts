import { BETA_PRICING } from './pricing';

/**
 * An order's three invoices' numbers (D-140, plan F4). Admin only: none of this reaches a customer (D-003).
 *  - A, the customer's invoice: what they paid (the order itself).
 *  - B, our landed cost: each piece's shop price ÷ 0.90 (handling) + its weight × ₹2 a gram (shipping), × quantity,
 *    the beta formula before its margin divisor (D-128), from the cost snapshot taken when the order was placed. It
 *    is provisional until every piece has been weighed at the hub (D-130), then final.
 *  - C, the shop bill: what the shops' carts cost, as the India desk typed it (rows, delivery, extras).
 * Margin = A − B ("over our cost") and A − C ("over the shop bill").
 */

export interface CostPiece {
  /** One piece's shop price when the order was placed. */
  shopPaise: number | null;
  /** The hub's scale if weighed, else the weight the price used. */
  weightG: number | null;
  weighed: boolean;
  quantity: number;
}

/** One line's landed cost in paise, or null when its shop price or weight is unknown. */
export function landedCostPaise(p: CostPiece): number | null {
  if (p.shopPaise === null || p.weightG === null) return null;
  const one = p.shopPaise / BETA_PRICING.shopDivisor + BETA_PRICING.shipPaisePerGram * p.weightG;
  return Math.round(one * p.quantity);
}

export interface InvoiceB {
  lines: (number | null)[];
  totalPaise: number;
  /** The total in US cents at the order's rate (₹92 when unknown, D-127). */
  totalCents: number;
  /** Lines whose shop price or weight is missing (left out of the total). */
  missing: number;
  /** Final once every piece is weighed at the hub. */
  final: boolean;
}

export function invoiceB(pieces: CostPiece[], inrPerUsd: number | null = null): InvoiceB {
  const lines = pieces.map(landedCostPaise);
  const totalPaise = lines.reduce<number>((s, l) => s + (l ?? 0), 0);
  const rate = inrPerUsd && inrPerUsd > 0 ? inrPerUsd : BETA_PRICING.inrPerUsd;
  return {
    lines,
    totalPaise,
    totalCents: Math.round(totalPaise / rate),
    missing: lines.filter((l) => l === null).length,
    final: pieces.length > 0 && pieces.every((p) => p.weighed) && lines.every((l) => l !== null),
  };
}

/** Paise to US cents at a rate (₹ a dollar). */
export function paiseToCents(paise: number, inrPerUsd: number | null = null): number {
  return Math.round(paise / (inrPerUsd && inrPerUsd > 0 ? inrPerUsd : BETA_PRICING.inrPerUsd));
}

/** Invoice C's total: each row's price × quantity (a coupon is a minus). */
export function shopBillTotalPaise(lines: { unit_paise: number; quantity: number }[]): number {
  return lines.reduce((s, l) => s + l.unit_paise * l.quantity, 0);
}

/** What the order brought in for margins: what was paid, less the tax (not ours) and anything refunded. */
export function orderRevenueCents(o: { total_cents: number; tax_cents: number; refunded_cents: number }): number {
  return o.total_cents - o.tax_cents - o.refunded_cents;
}

/** "42%" of revenue, or null with no revenue. */
export function marginPct(revenueCents: number, costCents: number): number | null {
  return revenueCents > 0 ? Math.round(((revenueCents - costCents) * 100) / revenueCents) : null;
}

/** "₹1,250" or "₹1,250.50" from paise, Indian grouping; "—" when unknown. Admin screens only. */
export function formatInr(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  const digits = paise % 100 ? 2 : 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(paise / 100);
}
