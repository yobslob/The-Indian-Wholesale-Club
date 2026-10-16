import { z } from 'zod';

import { formatGrams } from '../../domain/weight';
import { parseComboParts, parseWeightParts, weightKindOf, type WeightParts } from '../weight';

/**
 * D-135 (replaces D-133's packing): every food option is priced on its real weight, the net quantity its label
 * states (every packaged food in India prints one), unit by unit ("200 g (Pack of 3)" is 600 g), millilitres by
 * density; no packaging is added. The source stays "packed" in the database (D-133's value, so the deployed
 * functions write it), shown to admins as the label's net weight. A weight weighed at the hub or typed by an admin is
 * never replaced. An option whose net quantity nothing states keeps what it has (the runner's page search, the
 * estimator's suggestion, Weights to check, the hub's scale). tools/weight-estimator (`pnpm weights food`) and the
 * sourcing runner use it; worker_food_plan() names the listings and worker_set_food_weights() writes them.
 */

export const foodPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    description: z.string().nullable(),
    variants: z.array(
      z.object({
        id: z.string().uuid(),
        label: z.string(),
        options: z.record(z.string()).catch({}),
        weight_g: z.number().int().nullable(),
        weight_source: z.string().nullable(),
        weight_note: z.string().nullable(),
        net_qty: z.string().nullable().catch(null),
      }),
    ),
  }),
);
export type FoodListing = z.infer<typeof foodPlanSchema>[number];
type FoodVariant = FoodListing['variants'][number];

/** One option's net quantity: its units, where it was read, and how customers read it ("2 × 200 g"). */
export interface FoodNet {
  parts: WeightParts[];
  from: string;
  label: string;
}

const isPerson = (v: { weight_source: string | null }): boolean =>
  v.weight_source === 'weighed' || v.weight_source === 'admin';

function readParts(text: string): WeightParts[] | null {
  const combo = parseComboParts(text);
  if (combo) return combo;
  const one = parseWeightParts(text);
  return one && one.unitGrams >= 1 ? [one] : null;
}

const quantity = (p: WeightParts): string =>
  p.liquid
    ? p.unitGrams < 1000
      ? `${Math.round(p.unitGrams)} ml`
      : `${Number((p.unitGrams / 1000).toFixed(2))} L`
    : formatGrams(p.unitGrams);

/** "400 g", "2 × 200 g", "100 g + 100 g + 50 g", "1 L". */
export function netLabel(parts: WeightParts[]): string {
  return parts
    .map((p) => (p.count > 1 ? `${p.count} × ${quantity(p)}` : quantity(p)))
    .join(' + ')
    .slice(0, 40);
}

/** A kept weight's note read again: "amazon.in: Net Quantity: 400 g" is a net quantity, "Item Weight: 450 g" not. */
export function noteReading(note: string | null): { kind: string | null; text: string } | null {
  if (!note) return null;
  // the runner's "amazon.in item 400 g": the shop's item, its own pack
  const item = note.match(/^[a-z0-9.-]+\.[a-z]{2,} item (.+)$/i);
  if (item) return { kind: 'pack', text: item[1]! };
  const n = note.replace(/^[a-z0-9.-]+\.[a-z]{2,}:\s*/i, '');
  const at = n.indexOf(':');
  if (at < 0) return null;
  return { kind: weightKindOf(n.slice(0, at)), text: n.slice(at + 1) };
}

const PACK_OF = /\b(?:pack|set|combo|box) of (\d{1,2})\b/;
const NET_LINE = /\bnet\s*(?:wt|weight|quantity|qty|contents?)\.?\s*[:\-–]?\s*([^\n,;|]{1,30})/i;

/**
 * Where the option's net quantity is stated, most its own first: its options ("pack", "size"), its label, the page
 * reading kept with its weight (a shop page's or matching items' net, pack or title reading), then the listing's
 * name, then a "Net weight:" line in its description (the last two only for an option whose own words state none).
 */
export function foodNet(
  listing: Pick<FoodListing, 'name' | 'description'>,
  v: Pick<FoodVariant, 'label' | 'options' | 'weight_source' | 'weight_note'>,
): FoodNet | null {
  const own: [string, string][] = [
    ...Object.entries(v.options).map(([k, value]) => [value, `its ${k}`] as [string, string]),
    [v.label, 'its option'],
  ];
  const kept =
    v.weight_source === 'shop' || v.weight_source === 'similar' ? noteReading(v.weight_note) : null;
  if (kept && (kept.kind === 'net' || kept.kind === 'pack' || kept.kind === 'title'))
    own.push([kept.text, 'the shop page']);
  for (const [text, from] of own) {
    const parts = readParts(text);
    if (parts) return sane(parts, from);
  }
  // an option "Pack of 2" of a "Bhujia 400 g" is two of the name's packs
  const count = Number(own.map(([t]) => t.toLowerCase().match(PACK_OF)?.[1]).find(Boolean) ?? 1);
  const later: [string, string][] = [[listing.name, 'its name']];
  const line = (listing.description ?? '').match(NET_LINE);
  if (line) later.push([line[1]!, 'its description']);
  for (const [text, from] of later) {
    const parts = readParts(text);
    if (parts)
      return sane(
        parts.length === 1 && parts[0]!.count === 1 && count > 1
          ? [{ ...parts[0]!, count }]
          : parts,
        from,
      );
  }
  return null;
}

/** A net quantity from 1 g to 30 kg in all; anything else is a misread. */
function sane(parts: WeightParts[], from: string): FoodNet | null {
  const total = parts.reduce((g, p) => g + p.unitGrams * p.count, 0);
  return total >= 1 && total <= 30_000 ? { parts, from, label: netLabel(parts) } : null;
}

/** Grams a millilitre of it weighs: ghee 0.91, oil 0.92, honey 1.42, syrups 1.3, else water's. */
export function density(name: string): number {
  const t = name.toLowerCase();
  if (/\bghee\b/.test(t)) return 0.91;
  if (/\b(oil|tel)\b/.test(t)) return 0.92;
  if (/\bhoney\b/.test(t)) return 1.42;
  if (/\b(syrup|sharbat|sherbet|squash|rooh afza|molasses)\b/.test(t)) return 1.3;
  return 1;
}

/** The real weight of what the label states: every unit's net quantity (millilitres by density), to the gram. */
export function netGrams(parts: WeightParts[], name: string): number {
  return Math.round(
    parts.reduce((g, p) => g + (p.liquid ? p.unitGrams * density(name) : p.unitGrams) * p.count, 0),
  );
}

export interface FoodResult {
  variant: FoodVariant;
  net: FoodNet | null;
  /** The weight to price it on; null: keep what it has. */
  grams: number | null;
  note: string;
  /** Why an admin should look: no net quantity stated, or a weight that moves by more than a third. */
  look: string | null;
}

/** Every option of one food listing: the real weight its label states, or why it keeps what it has. */
export function weighFood(listing: FoodListing): FoodResult[] {
  return listing.variants.map((v) => {
    const net = foodNet(listing, v);
    if (!net)
      return {
        variant: v,
        net,
        grams: null,
        note: 'no net quantity stated',
        look: 'no net quantity: weigh it at the hub',
      };
    const grams = netGrams(net.parts, listing.name);
    const moves = v.weight_g !== null && Math.abs(grams - v.weight_g) * 3 > v.weight_g;
    return {
      variant: v,
      net,
      grams: isPerson(v) ? null : grams,
      note: `${net.label} net (${net.from}) (D-135)`.slice(0, 200),
      look: isPerson(v) ? null : moves ? `was ${formatGrams(v.weight_g!)}` : null,
    };
  });
}

export interface FoodWrite {
  variant_id: string;
  /** null: only its net quantity (a person weighed or typed its weight). */
  weight_g: number | null;
  note: string;
  net_qty: string | null;
}

/** What changes: a new weight or a new net quantity. */
export function foodWrites(results: FoodResult[]): FoodWrite[] {
  return results.flatMap((r) => {
    const netQty = r.net?.label ?? null;
    const weight =
      r.grams !== null &&
      (r.grams !== r.variant.weight_g ||
        r.variant.weight_source !== 'packed' ||
        r.variant.weight_note !== r.note);
    if (!weight && netQty === r.variant.net_qty) return [];
    return [
      {
        variant_id: r.variant.id,
        weight_g: weight ? r.grams : null,
        note: r.note,
        net_qty: netQty,
      },
    ];
  });
}
