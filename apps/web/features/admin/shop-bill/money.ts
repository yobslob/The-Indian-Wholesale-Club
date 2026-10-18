import { invoiceB, marginPct, orderRevenueCents, paiseToCents, shopBillTotalPaise, type CostPiece } from '@repo/shared/domain';

/**
 * An order's money for the admin (D-140, F4): invoice B (our landed cost) per piece and in all, invoice C's total when
 * a shop bill exists, and the margins A − B and A − C. Admin only (D-003).
 */
export interface OrderMoneyInput {
  total_cents: number;
  tax_cents: number;
  refunded_cents: number;
  items: {
    id: string;
    status: string;
    quantity: number;
    total_price_cents: number;
    shop_price_paise: number | null;
    weight_g: number | null;
    inr_per_usd: number | null;
    pickup: { weighed_g: number | null; shop_price_paise: number | null } | null;
  }[];
}

export interface OrderMoney {
  pieces: Map<string, { costPaise: number | null; costCents: number | null; marginPct: number | null }>;
  b: { paise: number; cents: number; final: boolean; missing: number };
  c: { paise: number; cents: number; final: boolean } | null;
  revenueCents: number;
  /** Null while a piece has no shop price or weight: a margin over part of the cost would read too high. */
  marginB: { cents: number; pct: number | null } | null;
  marginC: { cents: number; pct: number | null } | null;
}

export function orderMoney(order: OrderMoneyInput, bill: { status: string; lines: { unit_paise: number; quantity: number }[] } | null): OrderMoney {
  const active = order.items.filter((i) => i.status === 'active');
  const rate = active.find((i) => i.inr_per_usd)?.inr_per_usd ?? null;
  const cost: CostPiece[] = active.map((i) => ({
    // the snapshot taken when the order was placed; orders from before it fall back to the pickup's price
    shopPaise: i.shop_price_paise ?? i.pickup?.shop_price_paise ?? null,
    weightG: i.pickup?.weighed_g ?? i.weight_g,
    weighed: i.pickup?.weighed_g != null,
    quantity: i.quantity,
  }));
  const b = invoiceB(cost, rate);
  const pieces = new Map(
    active.map((i, n) => {
      const paise = b.lines[n] ?? null;
      const cents = paise === null ? null : paiseToCents(paise, i.inr_per_usd);
      return [i.id, { costPaise: paise, costCents: cents, marginPct: cents === null ? null : marginPct(i.total_price_cents, cents) }];
    }),
  );
  const revenueCents = orderRevenueCents(order);
  const cPaise = bill ? shopBillTotalPaise(bill.lines) : null;
  const cCents = cPaise === null ? null : paiseToCents(cPaise, rate);
  return {
    pieces,
    b: { paise: b.totalPaise, cents: b.totalCents, final: b.final, missing: b.missing },
    c: bill && cPaise !== null && cCents !== null ? { paise: cPaise, cents: cCents, final: bill.status === 'final' } : null,
    revenueCents,
    marginB: b.missing > 0 ? null : { cents: revenueCents - b.totalCents, pct: marginPct(revenueCents, b.totalCents) },
    marginC: cCents === null ? null : { cents: revenueCents - cCents, pct: marginPct(revenueCents, cCents) },
  };
}
