import type { StockProblemLine } from './types';
import type { CheckoutContext } from '@repo/db/server';

/** What checkout says about a problem line (§10 Y-3). */
export const stockWords = (line: Pick<StockProblemLine, 'available'>): string =>
  line.available > 0 ? `Only ${line.available} left` : 'Not available right now';

/**
 * §10 Y-3: the bag's lines that cannot go ahead as they are, from checkout_context's stock: sold out, no longer on sale
 * or fewer left than the bag asks. Pure. A line the store no longer sells (no row in `variants`) counts as not on sale.
 */
export function stockProblems(
  context: Pick<CheckoutContext, 'stock' | 'variants'>,
  quantities: ReadonlyMap<string, number>,
): StockProblemLine[] {
  const sold = new Set(context.variants.map((v) => v.variant_id));
  const lines: StockProblemLine[] = [];
  for (const s of context.stock) {
    const quantity = quantities.get(s.variant_id) ?? 0;
    const available = s.on_sale && sold.has(s.variant_id) ? Math.max(s.available, 0) : 0;
    if (available >= quantity) continue;
    lines.push({
      variantId: s.variant_id,
      productName: s.product_name,
      variantLabel: s.label,
      imagePath: s.image_path,
      quantity,
      available,
    });
  }
  return lines;
}
