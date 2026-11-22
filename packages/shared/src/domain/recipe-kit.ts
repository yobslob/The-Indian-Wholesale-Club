import { wasCents } from './pricing';

/**
 * D-203, Cook at home: a kit is a shortcut to pieces the store already sells. Its price is the sum of the ticked,
 * available pieces' store prices; its struck figure is that sum × food's factor (D-190's rule, applied to every kit),
 * display only. Adding a kit puts each piece in the bag as an ordinary line, once.
 */

/** What the kit card knows about one IWC line. */
export interface KitPiece {
  variantId: string | null;
  priceCents: number | null;
  available: boolean;
}

export interface KitTotal {
  /** The ticked, available pieces' prices added up. */
  cents: number;
  /** The struck figure beside it: `wasCents(cents, 'food')`. 0 when the kit is empty. */
  wasCents: number;
  count: number;
}

/** Whether a piece can go in the bag at all. */
export function kitPieceBuyable(p: KitPiece): p is KitPiece & { variantId: string; priceCents: number } {
  return p.available && p.variantId !== null && p.priceCents !== null;
}

/** The kit's total, struck figure and count for the ticked pieces (`ticked` holds variant ids). */
export function kitTotal(pieces: readonly KitPiece[], ticked: ReadonlySet<string> | null = null): KitTotal {
  let cents = 0;
  let count = 0;
  for (const p of pieces) {
    if (!kitPieceBuyable(p)) continue;
    if (ticked && !ticked.has(p.variantId)) continue;
    cents += p.priceCents;
    count += 1;
  }
  return { cents, wasCents: cents > 0 ? kitWasCents(cents) : 0, count };
}

/** The struck figure for a kit price (rule 2 of the plan). */
export function kitWasCents(kitCents: number): number {
  return wasCents(kitCents, 'food');
}

/**
 * The pieces Add puts in the bag: ticked and available, not already in the bag (a piece already there is left as it
 * is, never doubled), each once.
 */
export function kitPiecesToAdd<T extends KitPiece>(
  pieces: readonly T[],
  ticked: ReadonlySet<string>,
  inBag: ReadonlySet<string>,
): (T & { variantId: string; priceCents: number })[] {
  const seen = new Set<string>();
  const out: (T & { variantId: string; priceCents: number })[] = [];
  for (const p of pieces) {
    if (!kitPieceBuyable(p) || !ticked.has(p.variantId) || inBag.has(p.variantId) || seen.has(p.variantId))
      continue;
    seen.add(p.variantId);
    out.push(p);
  }
  return out;
}

/** Home's window lead: "<dish> kit" when the name is 12 characters or fewer, else "the whole kit" (plan §4.1). */
export function kitLead(name: string): string {
  const n = name.trim();
  return n.length <= 12 ? `${n} kit` : 'the whole kit';
}

/** The page's "Time" fact: "40 min", "1 h 15 min", plus the soak ("+ 8 h soak"). */
export function recipeTime(minutes: number, soakHours: number | null = null): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const cook = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return soakHours ? `${cook} + ${soakHours} h soak` : cook;
}
