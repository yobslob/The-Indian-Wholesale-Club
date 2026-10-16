import { formatGrams } from '../../domain/weight';
import { parseWeight, readWeights, type WeightReading } from '../weight';

/**
 * D-134: home & gifts are priced on the weight their own shop page states, read from its product details (Amazon's
 * "Item details" / "Measurements" dropdowns, the technical details table, the bullets). The packed weight wins (Item
 * Package Weight, Package Dimensions "…; 640 g"); with only the piece's own weight (Item Weight, Product Dimensions
 * "…; 500 g") its packing is added by what it is made of (glass and ceramic travel in a box with wrapping). Every
 * reading is checked against the others and against the piece's size, so a seller's slip ("1 g" brass lamp, a package
 * lighter than its piece) is marked for the hub instead of becoming a price. Customers never see any of it (D-132).
 * The size of the box is kept in the note: whether the courier bills by size is the founder's question (Q-36).
 */

/** How a piece travels, by what it is made of. */
export const HOME_PACKING = {
  fragile: { label: 'box and wrapping (fragile)', base: 120, per: 0.25 },
  sturdy: { label: 'box and wrapping', base: 60, per: 0.12 },
  flat: { label: 'flat box (art and frames)', base: 80, per: 0.15 },
  soft: { label: 'poly bag (textiles)', base: 20, per: 0.05 },
} as const;
export type HomePacking = keyof typeof HOME_PACKING;

const FRAGILE =
  /\b(glass|ceramic|porcelain|terracotta|clay|pottery|stoneware|bone china|marble|crystal|mirror|resin|earthen|kulhad)\b/;
const FLAT =
  /\b(painting|canvas|frame[ds]?|print|poster|wall art|pichwai|madhubani|pattachitra|tanjore|kalamkari art|warli art|wallpaper)\b/;
const SOFT =
  /\b(cotton|silk|fabric|cushion|bedsheet|bed sheet|pillow|cover|towel|rug|durrie|dhurrie|quilt|razai|runner|curtain|textile|jute|woollen|embroidered)\b/;

const lower = (t: string): string => t.toLowerCase();

/** Wood, metal or plastic in the same words: a box, even when it also has cotton or fabric (a puppet, a wall hanging). */
const STURDY =
  /\b(wood|wooden|mdf|metal|brass|iron|steel|copper|aluminium|bronze|plastic|bamboo|cane)\b/;

/** What the piece is made of, from its "Material" row first, then its page's name, then the listing's. */
export function homePacking(
  name: string,
  specs: [string, string][] = [],
  listingName = '',
): { packing: HomePacking; why: string } {
  const material =
    specs.find(([k]) =>
      /^(material|material type|frame material|base material)$/i.test(k.trim()),
    )?.[1] ?? '';
  for (const [text, where] of [
    [lower(material), 'its material'],
    [lower(name), 'its name'],
    [lower(listingName), 'its listing'],
  ] as const) {
    if (!text) continue;
    if (FLAT.test(text)) return { packing: 'flat', why: `${where} (${text.match(FLAT)![0]})` };
    if (FRAGILE.test(text))
      return { packing: 'fragile', why: `${where} (${text.match(FRAGILE)![0]})` };
    if (SOFT.test(text) && !STURDY.test(text))
      return { packing: 'soft', why: `${where} (${text.match(SOFT)![0]})` };
  }
  return { packing: 'sturdy', why: 'wood, metal or not stated' };
}

/** "30 x 20 x 10 cm", "11.8 x 7.9 x 3.9 inches", "10L x 5W x 20H Centimeters" as cm³; null when it is not three sizes. */
export function boxVolume(text: string): number | null {
  const t = lower(text).split(';')[0]!;
  const m = t.match(
    /(\d+(?:\.\d+)?)\s*[lwhd]?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[lwhd]?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[lwhd]?\s*(mm|millimet|cm|centimet|in(?:ch)?|")?/,
  );
  if (!m) return null;
  const unit = m[4] ?? 'cm';
  const k = /^mm|^millimet/.test(unit) ? 0.1 : /^in|"/.test(unit) ? 2.54 : 1;
  const v = Number(m[1]) * Number(m[2]) * Number(m[3]) * k * k * k;
  return v >= 1 && v <= 2_000_000 ? v : null;
}

export interface HomeWeight {
  /** The weight to price it on; null: none it can trust. */
  grams: number | null;
  /** shop: the page states the packed weight; packed: the piece's own weight plus its packing. */
  source: 'shop' | 'packed' | null;
  note: string;
  /** Why the hub should weigh it before it sells widely. */
  look: string | null;
  /** The courier's weight by size (cm³ ÷ 5,000), when the box size is known: kept for Q-36, never priced. */
  sizeG: number | null;
}

/** Grams per cm³ a packed or bare piece can have: below, the weight is too light for its box; above, too heavy. */
const DENSITY = { min: 0.01, max: 4 };

/**
 * One option's weight from its page: the packed weight when it is stated and believable (at least the piece, not
 * absurd for its box), else the piece plus its packing; readings that cannot both be right are marked.
 */
export function homeWeight(
  page: { title: string; specs: [string, string][] },
  hint: { name?: string; labels?: string[] } = {},
): HomeWeight {
  const readings: WeightReading[] = readWeights(page);
  // last: the option's own size as the shop sells it (Blinkit's "100 g"), the piece's weight without its packing
  for (const label of readings.length ? [] : (hint.labels ?? [])) {
    const w = parseWeight(label);
    if (w) {
      readings.push({
        grams: w.grams,
        kind: 'title',
        note: `Its option: ${label}`,
        liquid: w.liquid,
      });
      break;
    }
  }
  const pkg = readings.find((r) => r.kind === 'package');
  const item = readings.find((r) => r.kind !== 'package');
  const dims = (re: RegExp): number | null => {
    const row = page.specs.find(([k]) => re.test(lower(k)));
    return row ? boxVolume(row[1]) : null;
  };
  const boxCm3 = dims(/package dimensions|packaging dimensions/) ?? dims(/dimensions/);
  const sizeG = boxCm3 ? Math.round(boxCm3 / 5) : null;
  const { packing, why } = homePacking(page.title, page.specs, hint.name);
  const p = HOME_PACKING[packing];
  const dense = (g: number): boolean =>
    !boxCm3 || (g / boxCm3 >= DENSITY.min && g / boxCm3 <= DENSITY.max);
  const box = boxCm3 ? `; box ${Math.round(boxCm3 / 1000)} L, by size ${formatGrams(sizeG!)}` : '';
  const doubts: string[] = [];
  if (pkg && item && pkg.grams < item.grams)
    doubts.push(
      `its package (${formatGrams(pkg.grams)}) is lighter than the piece (${formatGrams(item.grams)})`,
    );

  if (pkg && (!item || pkg.grams >= item.grams) && dense(pkg.grams)) {
    return {
      grams: roundUp(pkg.grams),
      source: 'shop',
      note: `${short(pkg)}${box} (D-134)`.slice(0, 200),
      look: doubts[0] ?? null,
      sizeG,
    };
  }
  const piece = item ?? pkg;
  if (!piece)
    return {
      grams: null,
      source: null,
      note: 'the page states no weight',
      look: 'no weight on its page: weigh it at the hub',
      sizeG,
    };
  if (!dense(piece.grams)) {
    return {
      grams: null,
      source: null,
      note: `${short(piece)} does not fit its box${box}`.slice(0, 200),
      look: `${formatGrams(piece.grams)} cannot be right for its size: weigh it at the hub`,
      sizeG,
    };
  }
  const tare = p.base + p.per * piece.grams;
  return {
    grams: roundUp(piece.grams + tare),
    source: 'packed',
    note: `${short(piece)} + ${p.label} ${Math.round(tare)} g: ${why}${box} (D-134)`.slice(0, 200),
    look: doubts[0] ?? (packing === 'fragile' ? 'fragile: weigh one packed at the hub' : null),
    sizeG,
  };
}

const roundUp = (g: number): number => Math.ceil(g / 5) * 5;
const short = (r: WeightReading): string => r.note.replace(/\s+/g, ' ').slice(0, 90);
