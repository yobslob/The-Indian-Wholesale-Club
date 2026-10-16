/**
 * D-133: what a food piece is packed in, and what that packing weighs. The courier bills the packed piece (D-129), and
 * the label states only its contents: a 400 g pickle in a glass jar ships at about 660 g. The numbers are Claude's
 * (typical Indian retail packs, wrapping for glass included), not measurements; the hub's scale corrects them
 * (tareFactors in food.ts learns from every food piece weighed at the hub).
 */

export const FOOD_PACKS = [
  'pouch',
  'box',
  'sweet_box',
  'glass_jar',
  'plastic_jar',
  'jar',
  'tin',
  'glass_bottle',
  'plastic_bottle',
  'bottle',
  'sack',
] as const;
export type FoodPack = (typeof FOOD_PACKS)[number];

/** One unit's packing: `base` g plus `per` of its contents ("jar": glass or plastic, unknown, between the two). */
export const PACK_TARE: Record<FoodPack, { label: string; base: number; per: number }> = {
  pouch: { label: 'pouch', base: 6, per: 0.03 },
  box: { label: 'box', base: 15, per: 0.08 },
  sweet_box: { label: 'sweet box', base: 40, per: 0.12 },
  glass_jar: { label: 'glass jar, wrapped', base: 120, per: 0.35 },
  plastic_jar: { label: 'plastic jar', base: 15, per: 0.06 },
  jar: { label: 'jar (glass or plastic)', base: 65, per: 0.2 },
  tin: { label: 'tin', base: 40, per: 0.1 },
  glass_bottle: { label: 'glass bottle, wrapped', base: 150, per: 0.4 },
  plastic_bottle: { label: 'plastic bottle', base: 15, per: 0.04 },
  bottle: { label: 'bottle (glass or plastic)', base: 80, per: 0.22 },
  sack: { label: 'bag', base: 20, per: 0.015 },
};

export interface PackGuess {
  pack: FoodPack;
  /** "its name says jar", "pickles are usually in a jar". */
  why: string;
  /** The listing or its page names the pack (not a usual pack for its kind or category). */
  stated: boolean;
}

/** Packs a name, option or page names, strongest first. */
const STATED: [RegExp, FoodPack][] = [
  [/\bglass (jars?|containers?)\b|\bjars?\b[^.]{0,20}\bglass\b/, 'glass_jar'],
  [/\bglass bottles?\b|\bbottles?\b[^.]{0,20}\bglass\b/, 'glass_bottle'],
  [/\b(pet|plastic|pp|hdpe) (jars?|containers?|tubs?|boxes)\b|\btubs?\b/, 'plastic_jar'],
  [/\b(pet|plastic|hdpe) bottles?\b/, 'plastic_bottle'],
  [/\b(tins?|tinned|canned)\b/, 'tin'],
  [/\bjars?\b/, 'jar'],
  [/\bbottles?\b/, 'bottle'],
  [/\b(gift|sweets?|mithai) (box|boxes|pack)\b/, 'sweet_box'],
  [/\b(box|boxes|carton|cardboard)\b/, 'box'],
  [/\b(pouch(es)?|packets?|pkts?|sachets?|zip ?lock|standee|vacuum packed)\b/, 'pouch'],
  [/\b(sack|jute bag)\b/, 'sack'],
];

/** What the piece is, when nothing names its pack: [its kind, the pack it usually comes in, why]. */
const KINDS: [RegExp, FoodPack, string][] = [
  // before ghee and oil: a "desi ghee laddoo" is a sweet, a mixture "fried in groundnut oil" a snack
  [
    /\b(laddoos?|ladoos?|ladd?us?|barfis?|burfis?|pedas?|pedhas?|katli|mysore pak|sandesh|soan papdi|halwa|mithai|ghevar|petha|gajak|chikki|til ?patti|tilpatti|thekua|pinni|mathri)\b/,
    'sweet_box',
    'sweets',
  ],
  [
    /\b(namkeen|mixture|bhujia|chips|sev|chakli|murukku|khakhra|kachori|chivda|wafers)\b/,
    'pouch',
    'a snack',
  ],
  [/\bghee\b/, 'jar', 'ghee'],
  [/\bhoney\b/, 'jar', 'honey'],
  // before pickles and sweets in syrup: an "achar masala" or a "gulab jamun mix" is a dry powder
  [/\b(powder|podi|masala|mix)\b/, 'pouch', 'a powder'],
  [/\b(oil|tel)\b/, 'bottle', 'oil'],
  [
    /\b(sharbat|sherbet|syrup|squash|panha|juice|vinegar|rose water|kewra|rooh afza|thandai)\b/,
    'bottle',
    'a drink or syrup',
  ],
  [
    /\b(rasgull?as?|rosogollas?|gulab jamuns?|ras ?malai|rajbhog|cham ?chams?)\b/,
    'tin',
    'sweets in syrup',
  ],
  [
    /\b(pickles?|achaa?r|aachar|uppinakayi|thokku|avakaya|chutney|murabba|jam|preserve|spread)\b/,
    'jar',
    'a pickle or preserve',
  ],
  [/\b(tea bags?|green tea|chai)\b/, 'box', 'tea'],
  [/\b(ready to (eat|cook)|instant|retort)\b/, 'box', 'a ready meal'],
];

const CATEGORY_PACK: Record<string, [FoodPack, string]> = {
  sweets: ['sweet_box', 'sweets'],
  'snacks-and-namkeen': ['pouch', 'snacks'],
  'ground-spices': ['pouch', 'ground spices'],
  'whole-spices': ['pouch', 'whole spices'],
  'masala-blends': ['box', 'masala blends'],
  'pickles-and-chutneys': ['jar', 'pickles and chutneys'],
  'papad-and-wadi': ['pouch', 'papad and wadi'],
  'rice-flours-and-staples': ['pouch', 'staples'],
  'tea-and-drinks': ['pouch', 'tea and drinks'],
};

/** Lines that say how to store it after opening are not its pack ("store in an airtight glass jar"). */
const STORAGE =
  /\b(store|stored|storing|transfer|keep|kept|after opening|airtight|refrigerat|once opened)\w*/;

const lower = (t: string): string => t.toLowerCase().replace(/[‎‏ ]/g, ' ');

/** "Pickles & Chutneys" or "pickles-and-chutneys" as the category's slug. */
export const categoryKey = (category: string): string =>
  lower(category)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A page's spec rows that name the pack: Amazon's "Package Information: Jar", "Container Type", "Material: Glass". */
function fromSpecs(specs: [string, string][]): PackGuess | null {
  const rows = specs.filter(([k]) =>
    /package information|container|packaging type|material/i.test(k),
  );
  if (!rows.length) return null;
  const text = lower(rows.map(([k, v]) => `${k} ${v}`).join(' . '));
  const glass = /\bglass\b/.test(text);
  const plastic = /\b(plastic|pet|pp|hdpe)\b/.test(text);
  for (const [re, pack] of STATED) {
    if (!re.test(text)) continue;
    const sharpened =
      pack === 'jar' && glass
        ? 'glass_jar'
        : pack === 'jar' && plastic
          ? 'plastic_jar'
          : pack === 'bottle' && glass
            ? 'glass_bottle'
            : pack === 'bottle' && plastic
              ? 'plastic_bottle'
              : pack;
    return {
      pack: sharpened,
      why: `its page says ${rows[0]![1].slice(0, 30).trim()}`,
      stated: true,
    };
  }
  return null;
}

/** The pack as stated or usual, before a jar's material is settled (guessPack). */
function rawPack(input: {
  name: string;
  labels: string[];
  description?: string | null;
  category: string;
  netGrams: number;
  specs?: [string, string][];
}): PackGuess {
  const spec = input.specs ? fromSpecs(input.specs) : null;
  if (spec) return spec;
  const own = lower([input.name, ...input.labels].join(' . '));
  const sentences = lower(input.description ?? '')
    .split(/[.\n•;!?]+/)
    .filter((s) => !STORAGE.test(s))
    .join(' . ');
  for (const [text, where] of [
    [own, 'its name says'],
    [sentences, 'its description says'],
  ] as const) {
    for (const [re, pack] of STATED) {
      const m = text.match(re);
      if (!m) continue;
      // "bag" only for a sack of staples; a small "bag" of snacks is a pouch
      if (pack === 'sack' && input.netGrams < 2000)
        return { pack: 'pouch', why: `${where} "${m[0]}"`, stated: true };
      return { pack, why: `${where} "${m[0]}"`, stated: true };
    }
  }
  for (const [re, pack, kind] of KINDS) {
    const m = own.match(re);
    if (m)
      return {
        pack,
        why: `${kind} ("${m[0]}") usually comes in a ${PACK_TARE[pack].label}`,
        stated: false,
      };
  }
  const slug = categoryKey(input.category);
  if (slug === 'rice-flours-and-staples' && input.netGrams >= 2000)
    return { pack: 'sack', why: 'staples of 2 kg and more come in a bag', stated: false };
  const byCategory = CATEGORY_PACK[slug];
  if (byCategory)
    return {
      pack: byCategory[0],
      why: `${byCategory[1]} usually come in a ${PACK_TARE[byCategory[0]].label}`,
      stated: false,
    };
  return { pack: 'box', why: 'nothing says its pack: a box', stated: false };
}

/** Wet food (pickles, honey, ghee, syrups) and coffee often come in glass; a dry powder or snack in a jar is plastic. */
const WET =
  /\b(pickles?|achaa?r|aachar|uppinakayi|thokku|avakaya|chutney|murabba|jam|preserve|spread|honey|ghee|oil|tel|syrup|sharbat|sherbet|squash|juice|panha|vinegar|sauce|ketchup|paste|coffee)\b/;
const DRY =
  /\b(powder|podi|masala|mix|spices?|sprinkler|mukhwas|chikki|candy|toffee|namkeen|snacks?|tea)\b/;
const DRY_CATEGORIES = new Set([
  'ground-spices',
  'whole-spices',
  'masala-blends',
  'snacks-and-namkeen',
  'papad-and-wadi',
  'sweets',
]);

/**
 * What one food piece ships in: its page's spec rows, then what its name and options say, then its description
 * (never a line about storing it), then what such a piece usually comes in, then its category's usual pack. A jar or
 * bottle that does not say glass or plastic is plastic for dry food, and between the two otherwise.
 */
export function guessPack(input: Parameters<typeof rawPack>[0]): PackGuess {
  const guess = rawPack(input);
  if (guess.pack !== 'jar' && guess.pack !== 'bottle') return guess;
  const own = lower(input.name);
  const dry = DRY.test(own) || (!WET.test(own) && DRY_CATEGORIES.has(categoryKey(input.category)));
  if (!dry) return guess;
  return {
    ...guess,
    pack: guess.pack === 'jar' ? 'plastic_jar' : 'plastic_bottle',
    why: `${guess.why} (dry food: plastic)`,
  };
}

/** Grams a millilitre of it weighs: ghee 0.91, oil 0.92, honey 1.42, syrups 1.3, else water's. */
export function density(name: string): number {
  const t = lower(name);
  if (/\bghee\b/.test(t)) return 0.91;
  if (/\b(oil|tel)\b/.test(t)) return 0.92;
  if (/\bhoney\b/.test(t)) return 1.42;
  if (/\b(syrup|sharbat|sherbet|squash|rooh afza|molasses)\b/.test(t)) return 1.3;
  return 1;
}
