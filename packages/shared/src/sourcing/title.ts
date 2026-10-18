import type { ProductType } from '../domain/product-types';

/**
 * A shop's product title as IWC's name for the piece (D-140, plan L1): IWC is the seller (D-003), so a clothing or home
 * title loses the brand or shop at its start ("House of Pataudi …", "TWINS LADY …"), the words that only serve the
 * shop's search ("Women", "Regular", "Ethnic Motifs", "for Men"), and "with" between the pieces of a set ("Kurta,
 * Trousers & Dupatta"); then it keeps about six words, the garment last. Food keeps its brand: D-139 lists branded
 * snacks by brand ("Haldiram's Bhujia" is the product). The shop's full title stays admin-only (`products.shop_title`).
 */

const MAX_WORDS = 6;

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const FILLER = [
  /\bfor\s+(women|men|ladies|gents)\b/gi,
  /\b(women'?s?|womens|men'?s?|mens|ladies|gents)\b/gi,
  /\bethnic\s+motifs?\b/gi,
  /\b(regular|ethnic|trendy|stylish|latest|new|fashionable|beautiful|designer)\b/gi,
];

const tidy = (s: string): string =>
  s
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+,/g, ',')
    .replace(/^[\s,&–-]+|[\s,&–-]+$/g, '')
    .trim();

export function cleanTitle(title: string, opts: { brand?: string | null; productType?: ProductType | null } = {}): string {
  const original = tidy(title);
  if (opts.productType === 'food') return original;
  let t = original.replace(/\s*[|]\s.*$/, '');
  const brand = opts.brand?.trim();
  if (brand && brand.length >= 2) {
    t = t.replace(new RegExp(`^${escape(brand)}\\b[\\s:–-]*`, 'i'), '');
    t = t.replace(new RegExp(`\\s+by\\s+${escape(brand)}\\b`, 'i'), '');
  }
  t = t.replace(/^\s*amazon brand\s*[-–:]\s*/i, '');
  for (const re of FILLER) t = t.replace(re, ' ');
  // a set: "Kurta with Trousers & With Dupatta" → "Kurta, Trousers & Dupatta"
  const parts = tidy(t)
    .split(/\s*(?:&\s*)?\bwith\b\s*|\s*&\s*|\s*,\s*/i)
    .map(tidy)
    .filter(Boolean);
  if (parts.length === 0) return original;
  const tail = parts.slice(1);
  const tailWords = tail.reduce((n, p) => n + p.split(' ').length, 0);
  const headWords = parts[0]!.split(' ');
  const head = headWords.slice(-Math.max(2, MAX_WORDS - tailWords)).join(' ');
  const joined = tail.length === 0 ? head : tail.length === 1 ? `${head} & ${tail[0]}` : `${head}, ${tail.slice(0, -1).join(', ')} & ${tail[tail.length - 1]}`;
  const out = tidy(joined);
  return out.length >= 3 ? out : original;
}

/** True when a title still starts with its brand (the runner refuses such a name, D-140). */
export function startsWithBrand(title: string, brand: string | null | undefined): boolean {
  const b = brand?.trim();
  return Boolean(b && b.length >= 2 && new RegExp(`^${escape(b)}\\b`, 'i').test(title.trim()));
}

/** Words a name may start with that are never a brand (what the piece is, how it is made). */
const NOT_BRAND =
  /^(embroidered|printed|solid|woven|handloom|handwoven|pure|cotton|silk|linen|georgette|chiffon|rayon|kurta|kurti|saree|sari|lehenga|dupatta|shawl|stole|set|pack|block|hand|zari|banarasi|kanjivaram|chanderi|ikat|bandhani|phulkari|chikankari|ajrakh|kalamkari|brass|wooden|ceramic|clay|copper|steel|silver|gold|the|a|an|new|women|men|girls|boys|kids|unisex|ethnic|traditional|designer|floral|striped|checked|self)$/i;

/**
 * Brands among a shop's listing names, for names saved before D-140 (the brand was not kept): a one- to three-word start
 * shared by three or more of the names, or a leading run of two or more all-capital words ("TWINS LADY"). Never a word
 * that says what the piece is. A guess only: the admin approves every rename.
 */
export function guessBrands(names: string[]): string[] {
  const counts = new Map<string, number>();
  const brands = new Set<string>();
  for (const name of names) {
    const words = name.trim().split(/\s+/);
    for (let n = 1; n <= 3 && n < words.length; n += 1) {
      const head = words.slice(0, n);
      if (NOT_BRAND.test(head[0]!)) break;
      const key = head.join(' ').toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const caps = words.slice(0, 4).filter((w, i, all) => /^[A-Z][A-Z&'.-]+$/.test(w) && all.slice(0, i).every((x) => /^[A-Z][A-Z&'.-]+$/.test(x)));
    if (caps.length >= 2 && caps.length < words.length && !NOT_BRAND.test(caps[0]!)) brands.add(caps.join(' ').toLowerCase());
  }
  for (const [key, n] of counts) if (n >= 3) brands.add(key);
  // the longest shared start wins over its own first word ("house of pataudi" over "house")
  return [...brands].filter((b) => ![...brands].some((o) => o !== b && o.startsWith(`${b} `) && (counts.get(o) ?? 3) >= (counts.get(b) ?? 0)));
}
