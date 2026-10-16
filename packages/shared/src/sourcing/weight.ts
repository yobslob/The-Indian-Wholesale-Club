/**
 * Weights read from a shop's own page (D-129). The price is (shop ₹ ÷ 0.90 + weight g × ₹2) ÷ … (D-128), so a wrong
 * weight is a wrong price: every weight here says where it was read, and a page that names none gives none (never a
 * guess). Units: g, kg, mg is ignored (nutrition), ml and l count 1:1 as grams (marked), lb and oz converted.
 */

/** Where on the page a weight was read, strongest first: what the courier weighs is the packed piece. */
export const WEIGHT_KINDS = ['package', 'item', 'net', 'pack', 'title'] as const;
export type WeightKind = (typeof WEIGHT_KINDS)[number];

export interface WeightReading {
  grams: number;
  kind: WeightKind;
  /** What the page said, for the admin: "Package Dimensions: 30 x 20 x 3 cm; 320 g". */
  note: string;
  /** Read from ml or litres (1 ml counted as 1 g). */
  liquid: boolean;
}

export interface ParsedWeight {
  grams: number;
  liquid: boolean;
  /** "2 x 200 g" or "200 g (Pack of 2)": the pieces' weights added up. */
  multiplied: boolean;
}

const UNIT =
  '(kilograms?|kilos?|kgs?|grams?|gms?|gm|gr|g|pounds?|lbs?|ounces?|oz|millilit(?:er|re)s?|ml|lit(?:er|re)s?|ltrs?|ltr|l)';
const AMOUNT = '(\\d+(?:\\.\\d+)?)';
const WEIGHT_RE = new RegExp(`${AMOUNT}\\s*${UNIT}(?![a-z])`, 'g');
const TIMES_BEFORE_RE = new RegExp(`(\\d{1,2})\\s*[x×*]\\s*${AMOUNT}\\s*${UNIT}(?![a-z])`);
const TIMES_AFTER_RE = new RegExp(`${AMOUNT}\\s*${UNIT}\\s*[x×*]\\s*(\\d{1,2})(?![\\d.])`);
// "Pack of 100" tea bags counts; "box of 100 g" is a weight, not a count
const PACK_OF_RE =
  /\b(?:pack|set|combo|box) of (\d{1,3})\b(?!\s*(?:g|gms?|grams?|kgs?|ml|l|ltrs?|lit(?:er|re)s?)\b)|\b(\d{1,2})\s*(?:packs|pouches|jars|bottles)\b/;

function toGrams(amount: number, unit: string): { grams: number; liquid: boolean } {
  if (/^k/.test(unit)) return { grams: amount * 1000, liquid: false };
  if (/^(pound|lb)/.test(unit)) return { grams: amount * 453.6, liquid: false };
  if (/^(ounce|oz)/.test(unit)) return { grams: amount * 28.35, liquid: false };
  if (/^(millilit|ml)/.test(unit)) return { grams: amount, liquid: true };
  if (/^(lit|ltr|l$)/.test(unit)) return { grams: amount * 1000, liquid: true };
  return { grams: amount, liquid: false };
}

const ok = (grams: number): number | null =>
  grams >= 1 && grams <= 50_000 ? Math.round(grams) : null;

/** Lower case, Amazon's invisible marks gone, "1,000" as 1000, "1.0 kilograms" kept. */
function clean(text: string): string {
  let t = text.toLowerCase().replace(/[‎‏‪-‮ ]/g, ' ');
  while (/\d,\d{3}(?!\d)/.test(t)) t = t.replace(/(\d),(\d{3})(?!\d)/, '$1$2');
  return t;
}

/**
 * The weight a text states, in grams: "500 g", "1 kg", "1,000 g", "2 x 200 g", "200 g (Pack of 2)", "0.45 Kilograms",
 * "1 L". Several different weights with nothing to say which (a combo "400 g + 200 g") give none.
 */
export function parseWeight(text: string): ParsedWeight | null {
  const parts = parseWeightParts(text);
  if (!parts) return null;
  const grams = ok(parts.unitGrams * parts.count);
  return grams ? { grams, liquid: parts.liquid, multiplied: parts.count > 1 } : null;
}

/** One unit's weight and how many units: "2 x 200 g" is 200 g twice, each in its own pack (D-133). */
export interface WeightParts {
  unitGrams: number;
  count: number;
  liquid: boolean;
}

/** As parseWeight, kept as units: "200 g (Pack of 2)" is { unitGrams: 200, count: 2 }. */
export function parseWeightParts(text: string): WeightParts | null {
  const t = clean(text);
  const before = t.match(TIMES_BEFORE_RE);
  if (before) {
    const one = toGrams(Number(before[2]), before[3]!);
    return Number(before[1]) >= 1 ? { unitGrams: one.grams, count: Number(before[1]), liquid: one.liquid } : null;
  }
  const after = t.match(TIMES_AFTER_RE);
  if (after) {
    const one = toGrams(Number(after[1]), after[2]!);
    return Number(after[3]) >= 1 ? { unitGrams: one.grams, count: Number(after[3]), liquid: one.liquid } : null;
  }
  const found = [...t.matchAll(WEIGHT_RE)].map((m) => toGrams(Number(m[1]), m[2]!));
  const distinct = [...new Set(found.map((f) => Math.round(f.grams)))];
  if (distinct.length !== 1) return null;
  const one = found[0]!;
  const pack = t.match(PACK_OF_RE);
  const n = pack ? Number(pack[1] ?? pack[2]) : 1;
  if (n <= 1) return { unitGrams: one.grams, count: 1, liquid: one.liquid };
  // "400 g total (pack of 2)" is already the whole
  return /\btotal\b|\bin all\b/.test(t)
    ? { unitGrams: one.grams / n, count: n, liquid: one.liquid }
    : { unitGrams: one.grams, count: n, liquid: one.liquid };
}

const COMBO_JOIN = new RegExp(`${AMOUNT}\\s*${UNIT}(?![a-z])[^\\d+&]{0,40}?(?:\\+|&|\\band\\b)\\s*[^\\d]{0,40}?${AMOUNT}\\s*${UNIT}(?![a-z])`);

/**
 * A combo's parts, each in its own pack: "Recheado 100 g + Galouti 100 g + Frankie 50 g" (D-133). Only weights joined
 * by "+", "&" or "and", two to six of them; null otherwise.
 */
export function parseComboParts(text: string): WeightParts[] | null {
  const t = clean(text);
  if (!COMBO_JOIN.test(t)) return null;
  const parts = [...t.matchAll(WEIGHT_RE)].map((m) => toGrams(Number(m[1]), m[2]!));
  if (parts.length < 2 || parts.length > 6) return null;
  return parts.map((p) => ({ unitGrams: p.grams, count: 1, liquid: p.liquid }));
}

/** Which spec rows state a weight, and how strong each is. */
const SPEC_KINDS: [RegExp, WeightKind][] = [
  [/^(item )?(package|packaging|packed|shipping|gross) weight/, 'package'],
  [/^(item|product|unit) weight$|^weight$|^weight \(g(rams)?\)$/, 'item'],
  [/^net (quantity|weight|wt\.?|qty|content|contents)$|^quantity$|^net$/, 'net'],
];
const DIMENSIONS = /dimensions/;

/** What kind of weight a spec row's name states ("Net Quantity": net), or null: to reread a kept weight's note. */
export function weightKindOf(key: string): WeightKind | null {
  const k = specKey(key);
  if (k === 'title') return 'title';
  if (k === 'pack') return 'pack';
  return SPEC_KINDS.find(([re]) => re.test(k))?.[1] ?? (DIMENSIONS.test(k) ? (/package|packaging/.test(k) ? 'package' : 'item') : null);
}

const specKey = (key: string): string =>
  clean(key)
    .replace(/[:\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Every weight the page states (its specification rows, then its title), strongest first. */
export function readWeights(page: {
  title: string;
  specs: [string, string][];
}): WeightReading[] {
  const out: WeightReading[] = [];
  for (const [rawKey, value] of page.specs) {
    const key = specKey(rawKey);
    const label = rawKey.replace(/[‎‏]/g, '').replace(/[:\s]+$/, '').trim();
    let kind = SPEC_KINDS.find(([re]) => re.test(key))?.[1];
    let text = value;
    // Amazon: "Package Dimensions: 30 x 20 x 3 cm; 320 g" (the weight after the semicolon)
    if (!kind && DIMENSIONS.test(key) && value.includes(';')) {
      kind = /package|packaging/.test(key) ? 'package' : 'item';
      text = value.slice(value.indexOf(';') + 1);
    }
    if (!kind) continue;
    const w = parseWeight(text);
    if (w) out.push({ grams: w.grams, kind, note: `${label}: ${value.trim()}`.slice(0, 200), liquid: w.liquid });
  }
  const t = parseWeight(page.title);
  if (t) out.push({ grams: t.grams, kind: 'title', note: `Title: ${page.title}`.slice(0, 200), liquid: t.liquid });
  return out.sort((a, b) => WEIGHT_KINDS.indexOf(a.kind) - WEIGHT_KINDS.indexOf(b.kind));
}

/** Two readings that cannot both be right: a packed piece lighter than its contents, or more than twice it. */
function contradicts(best: WeightReading, other: WeightReading): boolean {
  if (best.kind === 'package' && other.kind !== 'package')
    return best.grams < other.grams || best.grams > other.grams * 2;
  return best.grams > other.grams * 1.25 || other.grams > best.grams * 1.25;
}

/**
 * The weight a listing is priced on: the strongest reading. `differs` is the first reading that contradicts it, so
 * the admin checks the page before the listing sells.
 */
export function bestWeight(
  readings: WeightReading[],
): (WeightReading & { differs: WeightReading | null }) | null {
  const best = readings[0];
  if (!best) return null;
  const differs = readings.find((r) => r !== best && contradicts(best, r)) ?? null;
  return { ...best, differs };
}

/** One weight several pages agree on (within 30%): their middle one; none when they disagree. */
export function agreedWeight(grams: number[]): number | null {
  const list = grams.filter((g) => g > 0).sort((a, b) => a - b);
  if (!list.length) return null;
  if (list[list.length - 1]! > list[0]! * 1.3) return null;
  return list[Math.floor((list.length - 1) / 2)]!;
}
