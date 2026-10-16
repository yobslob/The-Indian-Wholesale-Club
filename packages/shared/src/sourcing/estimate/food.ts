import { z } from 'zod';

import { formatGrams } from '../../domain/weight';
import { parseComboParts, parseWeightParts, weightKindOf, type WeightParts } from '../weight';

import { density, guessPack, PACK_TARE, type FoodPack, type PackGuess } from './food-packs';

/**
 * D-133: every food option is priced on its packed weight: the net quantity its label states (every packaged food
 * in India prints one), unit by unit, plus the weight of what it is packed in (food-packs.ts). A weight weighed at
 * the hub or typed by an admin is never replaced (source "packed" ranks below both). A shop page that states the
 * packed weight, believable for its net quantity, is used as it is. An option whose net quantity nothing states keeps
 * what it has (the runner's page search, the estimator's suggestion, Weights to check, the hub's scale).
 * tools/weight-estimator (`pnpm weights food`) and the sourcing runner use it; worker_food_plan() names the listings
 * and worker_set_food_weights() writes them.
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

/** Learned from the hub's scale: how much heavier (or lighter) each pack weighs than food-packs.ts says. */
export type TareFactors = Partial<Record<FoodPack, number>>;

/** Units this light (bars, sachets, tea bags) come many to one pack; heavier ones each in their own. */
const SHARED_UNIT_G = 50;

/** Packed grams: each unit's contents (ml by its density) and its own packing, rounded up to 5 g. */
export function packedGrams(
  parts: WeightParts[],
  pack: FoodPack,
  name: string,
  factors: TareFactors = {},
): { grams: number; net: number; tare: number } {
  const t = PACK_TARE[pack];
  const one = (g: number): number => (t.base + t.per * g) * (factors[pack] ?? 1);
  let net = 0;
  let tare = 0;
  for (const p of parts) {
    const unit = p.liquid ? p.unitGrams * density(name) : p.unitGrams;
    net += unit * p.count;
    // "16 g (Pack of 50)" chikki bars are one jar of 800 g; "100 g (Pack of 7)" tea is seven boxes
    tare += p.count > 1 && unit < SHARED_UNIT_G ? one(unit * p.count) : one(unit) * p.count;
  }
  return { grams: Math.ceil((net + tare) / 5) * 5, net: Math.round(net), tare: Math.round(tare) };
}

export interface FoodResult {
  variant: FoodVariant;
  net: FoodNet | null;
  pack: PackGuess | null;
  /** The weight to price it on; null: keep what it has. */
  grams: number | null;
  note: string;
  /** Why an admin should look: a jar or bottle that may be glass or plastic, a weight that moves by over a third. */
  look: string | null;
}

const PAGE_NOTE = "The shop's page states it packed:";

/** A page's stated packed weight is believable when it holds the contents and roughly the usual packing. */
function believable(page: number, net: number, tare: number): boolean {
  return page >= net + tare * 0.3 && page <= net + tare * 2.5 + 30;
}

/** Every option of one food listing: its packed weight and why, or why it keeps what it has. */
export function weighFood(
  listing: FoodListing,
  opts: { factors?: TareFactors; specs?: [string, string][] } = {},
): FoodResult[] {
  return listing.variants.map((v) => {
    const net = foodNet(listing, v);
    if (!net)
      return {
        variant: v,
        net,
        pack: null,
        grams: null,
        note: 'no net quantity stated',
        look: 'no net quantity: weigh it at the hub',
      };
    const total = net.parts.reduce((g, p) => g + p.unitGrams * p.count, 0);
    const pack = guessPack({
      name: listing.name,
      labels: [v.label, ...Object.values(v.options)],
      description: listing.description,
      category: listing.category,
      netGrams: total,
      specs: opts.specs,
    });
    const w = packedGrams(net.parts, pack.pack, listing.name, opts.factors);
    const kept =
      v.weight_source === 'shop' && v.weight_g !== null ? noteReading(v.weight_note) : null;
    // the shop page's packed weight, as read now or as kept by an earlier pass
    const page =
      v.weight_g !== null &&
      ((kept &&
        (kept.kind === 'package' || kept.kind === 'item') &&
        believable(v.weight_g, w.net, w.tare)) ||
        (v.weight_source === 'packed' && (v.weight_note ?? '').startsWith(PAGE_NOTE)))
        ? v.weight_g
        : null;
    const grams = page ?? w.grams;
    const note = page
      ? `${PAGE_NOTE} ${formatGrams(page)} (${net.label} net) (D-133)`
      : `${net.label} net (${net.from}) + ${PACK_TARE[pack.pack].label} ${w.tare} g: ${pack.why} (D-133)`;
    const moves = v.weight_g !== null && Math.abs(grams - v.weight_g) * 3 > v.weight_g;
    // a pouch or box guessed wrong is a few grams; glass or plastic, a few hundred
    const unsure = !page && (pack.pack === 'jar' || pack.pack === 'bottle');
    const look = isPerson(v)
      ? null
      : unsure
        ? 'glass or plastic? weigh one at the hub'
        : moves
          ? `was ${formatGrams(v.weight_g!)}`
          : null;
    return {
      variant: v,
      net,
      pack,
      grams: isPerson(v) ? null : grams,
      note: note.slice(0, 200),
      look,
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

/**
 * D-133: the hub's scale teaches the packing weights. For every food piece weighed at the hub whose net quantity its
 * name or option states, the packing it really had against the packing food-packs.ts gives it; a pack with three or
 * more such pieces gets their middle ratio (kept within half to twice the table's).
 */
export function tareFactors(
  weighed: {
    name: string;
    category: string;
    label: string;
    options: Record<string, string>;
    weight_g: number;
  }[],
): TareFactors {
  const ratios: Partial<Record<FoodPack, number[]>> = {};
  for (const r of weighed) {
    const net = foodNet(
      { name: r.name, description: null },
      { label: r.label, options: r.options, weight_source: null, weight_note: null },
    );
    if (!net) continue;
    const total = net.parts.reduce((g, p) => g + p.unitGrams * p.count, 0);
    const pack = guessPack({
      name: r.name,
      labels: [r.label],
      category: r.category,
      netGrams: total,
    }).pack;
    const w = packedGrams(net.parts, pack, r.name);
    const real = r.weight_g - w.net;
    if (w.tare <= 0 || real <= 0 || real > w.tare * 5) continue; // a misread label, not a pack
    (ratios[pack] ??= []).push(real / w.tare);
  }
  const out: TareFactors = {};
  for (const [pack, list] of Object.entries(ratios) as [FoodPack, number[]][]) {
    if (list.length < 3) continue;
    const sorted = list.sort((a, b) => a - b);
    out[pack] = Math.min(2, Math.max(0.5, sorted[Math.floor(sorted.length / 2)]!));
  }
  return out;
}
