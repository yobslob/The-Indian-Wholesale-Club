import type { ProductType } from '../domain/product-types';

/**
 * A shop's product title as IWC's name for the piece. IWC is the seller (D-003), so a clothing or home title loses the
 * brand or shop and nothing else (founder, 2026-10-21: "we just wanted to remove the shop's name"): the brand at its
 * start ("House of Pataudi …", "TWINS LADY …"), "by <brand>", a "| <brand>" tail and "Amazon Brand –". Every other
 * word stays: "3 in 1 Incense Sticks", "100% Pure Brass Urli", "for Women", sizes and sets. (D-140's first rules also
 * cut "search words" and kept about six words; they cut real words, so they are gone.) Food keeps its brand: D-139
 * lists branded snacks by brand ("Haldiram's Bhujia" is the product). The shop's full title stays admin-only
 * (`products.shop_title`).
 */

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The shops IWC imports from: their names never belong in a piece's name. */
const SHOPS = /\b(amazon(\.in)?|flipkart|myntra|ajio|meesho|nykaa|blinkit|zepto|swiggy instamart|instamart|bigbasket|nishorama|oyela|offduty)\b/i;

const tidy = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,:|&–-]+|[\s,:|&–-]+$/g, '')
    .trim();

export function cleanTitle(title: string, opts: { brand?: string | null; productType?: ProductType | null } = {}): string {
  const original = tidy(title);
  if (opts.productType === 'food') return original;
  let t = original.replace(/^\s*amazon brand\s*[-–:]\s*/i, '');
  const brand = opts.brand?.trim();
  if (brand && brand.length >= 2) {
    const b = escape(brand);
    t = t.replace(new RegExp(`^${b}(?:'s)?\\b[\\s:–-]*`, 'i'), '');
    t = t.replace(new RegExp(`\\s+by\\s+${b}\\b`, 'i'), '');
    // "… | Brand" or "… - Brand" at the end
    t = t.replace(new RegExp(`\\s*[|–-]\\s*${b}\\s*$`, 'i'), '');
  }
  // a "| Amazon.in" or "- Myntra" tail: the shop, not the piece
  t = t.replace(new RegExp(`\\s*[|–-]\\s*(?:${SHOPS.source})\\s*$`, 'i'), '');
  const out = tidy(t);
  return out.length >= 3 ? out : original;
}

/** True when a title still starts with its brand (the runner refuses such a name, D-140). */
export function startsWithBrand(title: string, brand: string | null | undefined): boolean {
  const b = brand?.trim();
  return Boolean(b && b.length >= 2 && new RegExp(`^${escape(b)}\\b`, 'i').test(title.trim()));
}

/**
 * Words that say what a piece is, what it is made of, how many, or how it looks: never part of a brand. Checked on every
 * word of a guess, not only the first.
 */
const NOT_BRAND = new Set(
  (
    'a an in for with set pack combo pair pairs piece pieces pcs kit box gift hamper ' +
    'new latest premium original authentic traditional designer ethnic regular classic modern vintage antique royal ' +
    'handmade handcrafted handwoven handloom hand made crafted painted printed embroidered woven solid floral striped ' +
    'checked self plain pure natural organic real genuine heavy light small large big mini medium round square tall ' +
    'decorative decor decoration home pooja puja diwali festive festival wedding party daily ' +
    'women womens ladies men mens gents girls boys kids unisex baby ' +
    'cotton silk linen georgette chiffon rayon viscose crepe velvet wool woollen khadi muslin net satin denim ' +
    'brass copper bronze silver gold golden steel iron metal metallic wooden wood bamboo cane jute ceramic clay ' +
    'terracotta marble stone glass resin oxidised oxidized kundan meenakari ' +
    'kurta kurti kurtas kurtis saree sari sarees lehenga dupatta shawl stole suit sherwani dhoti mundu turban ' +
    'jhumka jhumkas earrings bangles bangle necklace bracelet anklet ring bindi ' +
    'block zari banarasi kanjivaram chanderi ikat bandhani phulkari chikankari ajrakh kalamkari madhubani warli ' +
    'incense agarbatti dhoop diya diyas lamp urli bowl thali plate tray idol statue figurine candle holder stand ' +
    'wall hanging art painting frame toran rangoli showpiece'
  ).split(' '),
);

const plainWord = (w: string): boolean => /^[A-Za-z][A-Za-z&'.-]*$/.test(w) && !NOT_BRAND.has(w.toLowerCase().replace(/[^a-z]/g, ''));
/** Words a brand may hold but not end on ("House of Pataudi", "The Wallet Store"). */
const LINK = new Set(['of', 'the', 'and', '&', 'n']);

/**
 * Brands among one shop's listing names, for names saved before D-140 (the brand was not kept): a one- to three-word
 * start shared by three or more names, or a leading run of two or more all-capital words ("TWINS LADY"). A guess is
 * refused when any of its words has a digit or a sign ("3 in 1", "100% Pure"), says what the piece is or is made of
 * (NOT_BRAND), or when the same words also turn up later inside other names (a product word, not a maker). A guess
 * only: the admin approves every rename.
 */
export function guessBrands(names: string[]): string[] {
  const lowered = names.map((n) => ` ${n.trim().toLowerCase().replace(/\s+/g, ' ')} `);
  const inside = (key: string): number => lowered.filter((n) => n.indexOf(` ${key} `) > 0).length;
  const counts = new Map<string, number>();
  const brands = new Set<string>();
  for (const name of names) {
    const words = name.trim().split(/\s+/);
    for (let n = 1; n <= 3 && n < words.length; n += 1) {
      const w = words[n - 1]!;
      if (LINK.has(w.toLowerCase())) continue;
      if (!plainWord(w)) break;
      const key = words.slice(0, n).join(' ').toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const caps: string[] = [];
    for (const w of words.slice(0, 4)) {
      if (!/^[A-Z][A-Z&'.-]+$/.test(w) || !plainWord(w)) break;
      caps.push(w);
    }
    if (caps.length >= 2 && caps.length < words.length) brands.add(caps.join(' ').toLowerCase());
  }
  for (const [key, n] of counts) if (n >= 3) brands.add(key);
  const kept = [...brands].filter((b) => inside(b) < 2);
  // the longest shared start wins over its own first word ("house of pataudi" over "house")
  return kept.filter((b) => !kept.some((o) => o !== b && o.startsWith(`${b} `) && (counts.get(o) ?? 3) >= (counts.get(b) ?? 0)));
}
