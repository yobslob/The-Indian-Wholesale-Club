/**
 * D-132: clothing is weighed by class, the founder's four weights. A listing's class comes from its name, read in
 * the order a person would: what it is made of as a whole (a co-ord, jewellery, a lehenga, a set) before the single
 * piece its name also mentions (the kurta of a "kurta with pyjama" set). A name no rule reads falls back to its
 * category; what neither reads is left to the local model (tools/weight-estimator) or an admin.
 */

export const CLOTHING_CLASSES = ['light', 'medium', 'bottoms', 'heavy'] as const;
export type ClothingClass = (typeof CLOTHING_CLASSES)[number];

/** The founder's weights (D-132). */
export const CLASS_GRAMS: Record<ClothingClass, number> = {
  light: 350,
  medium: 750,
  bottoms: 800,
  heavy: 1500,
};

export const CLASS_LABEL: Record<ClothingClass, string> = {
  light: 'Light, 350 g',
  medium: 'Medium, 750 g',
  bottoms: 'Pants, jeans and footwear, 800 g',
  heavy: 'Heavy, 1.5 kg',
};

/** What each class holds, in the founder's words and Claude's reading of them (D-132): for the model and the docs. */
export const CLASS_MEANING: Record<ClothingClass, string> = {
  light:
    'headwear, jewellery (jhumkas, bangles), a kurti, a plain or short kurta, tops, shirts, blouses, salwar, churidar, leggings, pyjama or shorts alone, a gamosa, a kaftan, a dress, gown or skirt',
  medium:
    'a light saree (cotton, georgette, chiffon), a dupatta, stole or muffler, a potli or pouch, a silk, velvet, Anarkali or long kurta, a dhoti or mundu, jackets and knitwear, co-ord sets',
  bottoms: 'pants, jeans, trousers, palazzos, dhoti pants, and footwear (mojaris, juttis, sandals)',
  heavy:
    'shawls, a very heavy saree (Banarasi or Kanjivaram silk, bridal, brocade), a lehenga, sherwani, sharara or gharara, and any set (a suit, a kurta with pyjama or dupatta, a 3-piece)',
};

export interface ClassResult {
  cls: ClothingClass;
  /** Why, for the admin and the review sheet: "a set (kurta with pyjama)". */
  why: string;
  by: 'name' | 'category';
}

const SAREE_STRONG =
  /\b(kanjivaram|kanjeevaram|kanchipuram|kanchi|paithani|patola|baluchari|pattu|himroo|bridal|brocade|velvet|tissue|heavy|pure silk)\b/;
// zari alone is not heavy: most zari sarees are light cotton or georgette with a zari border
const SAREE_WEAK = /\b(banaras[i]?|benaras[i]?|wedding|silk)\b/;
const LIGHT_FABRIC =
  /\b(cotton|georgette|chiffon|organza|linen|chanderi|kota|mulmul|crepe|rayon|viscose|net|tant|jamdani|blend|art silk|poly|kasavu|handloom|khadi)\b/;
const HEAVY_KURTA = /\b(velvet|brocade|sequin(ned|s)?|zari|dupion|silk|anarkali|long kurta)\b/;
const SECOND_GARMENT =
  /\b(with|and|&|\+)\s+(the\s+)?(pyjamas?|pajamas?|palazzos?|pants?|trousers|dupattas?|churidars?|salwars?|dhoti|jackets?|nehru|waist ?coats?|skirts?|shararas?|ghararas?|leggings|shrugs?|stoles?|jubba|mundu|tehmat|tehband|lungi|shirts?|kurtas?|kurtis?|choli|lehenga|bottoms?)\b/;

/** [what it matches, its class, why, unless the name also has this]. */
type Rule = [RegExp, ClothingClass, string, RegExp?];

/** In order: the first that matches decides. */
const RULES: Rule[] = [
  [/\bco[- ]?ords?\b/, 'medium', 'a co-ord set'],
  [
    /\bsaree blouses?\b|\bblouses? for sarees?\b|^(?!.*\b(sarees?|saris?)\b).*\bblouse piece\b/,
    'light',
    'a blouse',
  ],
  [
    /\b(jhumk[ai]s?|earrings?|ear ?cuffs?|bangles?|chura|chooda|kalire|kaleeras?|kad[ae]s?|kangans?|necklaces?|choker|payals?|anklets?|maang ?tikka|tikka|nath(?![- ]motif)|nose ?rings?|kamarbandh|waist ?chain|paranda|parandi|brooch)\b/,
    'light',
    'jewellery',
  ],
  [
    /\b(half[- ]?saree|davani|langa ?voni|pattu pavadai|pavadai|pavada|parkar|mekhela)\b/,
    'heavy',
    'a set (half-saree, pavadai or mekhela)',
  ],
  [/\b(dress material|unstitched suit)\b/, 'heavy', 'a set (unstitched suit)'],
  [/\b(shawls?|pashmina|dushala|loi|phiran|pheran|chadd?ars?|chadors?)\b/, 'heavy', 'a shawl'],
  [
    // "Poshak Hub" is a brand
    /\b(leh[ae]n?ngas?|lehnga|ghagh?ras?|chaniya|poshak(?! hub)|shararas?|ghararas?|sherwanis?|achkan)\b/,
    'heavy',
    'a lehenga, sherwani or sharara',
  ],
  [/\bset[- ](sarees?|mundus?)\b/, 'medium', 'a Kerala set-saree'],
  [/\bsets?\b|\bsuits?\b|\b(two|three|four|2|3|4)[- ]?(piece|pc)s?\b/, 'heavy', 'a set'],
  [
    /\bkurta[- ](pyjama|pajama|churidar|salwar|dhoti)s?\b|\bdhoti[- ]kurta\b|\bsalwar[- ]kameez\b/,
    'heavy',
    'a set',
  ],
  [
    /\b(juttis?|jutis?|mojaris?|mojdis?|kolhapuris?(?! sarees?)|chappals?|sandals?|shoes?|sneakers|heels|footwear|slippers|loafers|nagras?|flip[- ]?flops|wedges)\b/,
    'bottoms',
    'footwear',
  ],
  [
    /\b(jeans|denims?|trousers|pants?|palazzos?|joggers|cargos?|chinos|dhoti[- ]pants?)\b/,
    'bottoms',
    'pants',
    /\bskirts?\b|\bkurt[ai]s?\b/,
  ],
  [
    /\b(salwars?|patialas?|churidars?|leggings|pyjamas?|pajamas?|shorts)\b/,
    'light',
    'a salwar or pyjama',
  ],
  [
    /\b(jackets?|bandi|waist ?coats?|coats?|blazers?|cardigans?|sweaters?|pullovers?|hoodies?|sweatshirts?|shrugs?|bolero|kimono|bandhgala)\b/,
    'medium',
    'a jacket or knitwear',
  ],
  [
    /\b(sarees?|saris?|nauvari|kashta|dokhona)\b|\bkasavu\b(?!.*\b(mundu|kurta|shirt|dhoti|jubba)\b)/,
    'medium',
    'a saree',
  ],
  [
    /\b(dress(es)?|gowns?|kaftans?|caftans?|jumpsuits?|maxi|frocks?|skirts?)\b/,
    // the founder, 2026-10-16: "Gamosa, Kaftan, dress or skirt should be in 350g"
    'light',
    'a dress or skirt',
  ],
  [/\b(kurtis?|short kurtas?)\b/, 'light', 'a kurti'],
  [/\b(kurtas?|jubba|sadra|angrakha|kameez|tunics?|pathani)\b/, 'light', 'a kurta'],
  [
    /\b(dupattas?|odhnis?|odhnas?|chunr[iy]s?|chunnis?|stoles?|scarf|scarves|mufflers?|kavani|angavastram|bagh|phulkari)\b/,
    'medium',
    'a dupatta or stole',
  ],
  [/\b(dhotis?|mundus?|lungis?|kaili|veshtis?|panche|dhotar)\b/, 'medium', 'a dhoti or mundu'],
  [/\b(potlis?|pouch(es)?|clutch(es)?|bags?|jholas?|batua|purse)\b/, 'medium', 'a potli or pouch'],
  [/\bgamo?sas?\b/, 'light', 'a gamosa'],
  [
    /\b(tops?|tees?|t-?shirts?|shirts?|blouses?|crop|camis?|tanks?|bodysuits?|choli|polo)\b/,
    'light',
    'a top or shirt',
  ],
  [
    /\b(caps?|topis?|turbans?|pagdis?|pagris?|paguris?|phetas?|safas?|patkas?|hats?|beanies?|headbands?)\b/,
    'light',
    'headwear',
  ],
];

/** The category's class when the name says nothing (seeded clothing categories; D-110). */
const CATEGORY_CLASS: Record<string, ClothingClass> = {
  kurtas: 'light',
  'shirts-and-tops': 'light',
  headwear: 'light',
  accessories: 'light',
  'co-ords-and-dresses': 'medium',
  'dupattas-and-stoles': 'medium',
  'dhotis-and-mundus': 'medium',
  'jackets-and-knitwear': 'medium',
  sarees: 'medium',
  'jeans-and-trousers': 'bottoms',
  footwear: 'bottoms',
  shawls: 'heavy',
  lehengas: 'heavy',
  'suits-and-sets': 'heavy',
};

/** "Kurta-Pyjama & Dupatta" → "kurta-pyjama and dupatta": lower case, one spacing, & read as "and". */
const clean = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[(),.|/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** A clothing listing's class, or null when neither its name nor its category says (the model or an admin decides). */
export function classifyClothing(listing: {
  name: string;
  categorySlug: string | null;
}): ClassResult | null {
  const name = clean(listing.name);
  // a garment with a second garment is a set, unless it is a saree (with its blouse piece)
  if (!/\b(sarees?|saris?|kasavu)\b/.test(name)) {
    const second = name.match(SECOND_GARMENT);
    if (
      second &&
      /\b(kurt[ai]s?|shirts?|tops?|jackets?|dhoti|mundu|lehenga|choli|blouse|gown|dress|tunic|jubba|anarkali)\b/.test(
        name.slice(0, second.index),
      )
    )
      return {
        cls: 'heavy',
        why: `a set (${second[0].replace(/^(with|and|\+)\s+/, 'with ')})`,
        by: 'name',
      };
  }
  for (const [re, cls, why, unless] of RULES) {
    const m = name.match(re);
    if (!m || unless?.test(name)) continue;
    if (why === 'a saree') {
      const strong = name.match(SAREE_STRONG);
      const weak = name.match(SAREE_WEAK);
      if (strong) return { cls: 'heavy', why: `a very heavy saree (${strong[0]})`, by: 'name' };
      if (weak && !LIGHT_FABRIC.test(name))
        return { cls: 'heavy', why: `a very heavy saree (${weak[0]})`, by: 'name' };
      return { cls: 'medium', why: 'a light saree', by: 'name' };
    }
    if (why === 'a kurta') {
      const heavy = name.match(HEAVY_KURTA);
      if (heavy && !/\bart silk\b|\bsilk blend\b/.test(name))
        return { cls: 'medium', why: `a heavier kurta (${heavy[0]})`, by: 'name' };
    }
    return { cls, why: `${why} (${m[0]})`, by: 'name' };
  }
  const byCategory = listing.categorySlug ? CATEGORY_CLASS[listing.categorySlug] : undefined;
  return byCategory
    ? { cls: byCategory, why: `its category (${listing.categorySlug})`, by: 'category' }
    : null;
}

/**
 * A clothing option's weight in its class: its pack "Pack of 3" (or "3"), else a "Pack of 2" in the listing's name,
 * is that many pieces.
 */
export function classGrams(cls: ClothingClass, options: Record<string, string>, name = ''): number {
  const pack = options.pack
    ? options.pack.match(/\b(\d{1,2})\b/)?.[1]
    : clean(name).match(/\bpack of (\d{1,2})\b/)?.[1];
  const n = Number(pack ?? 1);
  return CLASS_GRAMS[cls] * (n >= 1 && n <= 12 ? n : 1);
}
