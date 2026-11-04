import type { BagLine } from '../cart/store';
import type { StockProblemLine } from '@repo/shared/domain';

/** The server's stock problems as the checkout screen draws them (§10 Y-3). Pure, so it has unit tests. */

export interface StockRow {
  variantId: string;
  name: string;
  option: string;
  imagePath: string | null;
  note: string;
  /** "Keep 2": what is left, when some are. Null: only Remove. */
  keep: number | null;
}

/** An option that no longer exists has no words of its own: the bag's stand in. A line with nothing wrong is left out. */
export function stockRows(problems: StockProblemLine[], bag: BagLine[]): StockRow[] {
  return problems
    .filter((p) => p.available < p.quantity)
    .map((p) => {
      const line = bag.find((l) => l.variantId === p.variantId);
      return {
        variantId: p.variantId,
        name: p.productName ?? line?.productName ?? '',
        option: p.variantLabel ?? line?.variantLabel ?? '',
        imagePath: p.imagePath ?? line?.imagePath ?? null,
        note: p.available > 0 ? `Only ${p.available} left` : 'Not available right now',
        keep: p.available > 0 ? p.available : null,
      };
    });
}

/** The lines of a `stock` problem in a refused checkout's answer; empty for any other answer. */
export function stockProblemLines(problem: unknown): StockProblemLine[] {
  if (typeof problem !== 'object' || problem === null) return [];
  const { kind, lines } = problem as { kind?: unknown; lines?: unknown };
  return kind === 'stock' && Array.isArray(lines) ? (lines as StockProblemLine[]) : [];
}
