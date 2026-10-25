/**
 * Search's suggestions while typing (D-160), for the website and the app alike: pure, so it runs in the browser and on
 * the phone from one small list the CDN keeps (store_search_hints()), never a database call per keystroke. The
 * database does the real search (store_search_page); this only offers what to search for or where to go.
 */
import { isProductType, type ProductType } from '../domain/product-types';

export interface SearchHints {
  /** The listings' words, most used first (at most 1,500). */
  words: string[];
  /** Words that mean the same to a customer (sari, saree), only groups the listings use. */
  synonyms: string[][];
  categories: { type: ProductType; slug: string; name: string; count: number }[];
  regions: { slug: string; name: string; count: number }[];
  /** Searches many customers made that found pieces, made only of the listings' own words. */
  popular: string[];
}

export const EMPTY_HINTS: SearchHints = { words: [], synonyms: [], categories: [], regions: [], popular: [] };

export type Suggestion =
  | { kind: 'search'; label: string; query: string }
  | { kind: 'state'; label: string; slug: string; count: number }
  | { kind: 'category'; label: string; type: ProductType; slug: string; count: number };

/** The most a search keeps (store_search_page reads 100 characters). */
export const SEARCH_MAX = 100;

/** A search as it is sent: spaces collapsed, trimmed, at most 100 characters. */
export function cleanSearch(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX);
}

/** A search's words: lower case, letters (any script, with their vowel signs) and digits, as the database splits them. */
export function searchWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length > 0);
}

/** Levenshtein distance, given up past `max` (returns max + 1): small words, small lists. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      row.push(v);
      best = Math.min(best, v);
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length] ?? max + 1;
}

/** The words that complete `part`: beginnings first (most used first), then near misses ("kurth" → kurta). */
function complete(part: string, words: string[], limit: number): string[] {
  if (!part) return [];
  const out = words.filter((w) => w.startsWith(part) && w !== part).slice(0, limit);
  if (out.length >= limit || part.length < 4) return out;
  const max = part.length >= 6 ? 2 : 1;
  for (const w of words) {
    if (out.length >= limit) break;
    if (w === part || out.includes(w) || w.length < part.length) continue;
    if (w[0] === part[0] && editDistance(w.slice(0, part.length), part, max) <= max) out.push(w);
  }
  return out;
}

const startsAWord = (name: string, part: string): boolean => searchWords(name).some((w) => w.startsWith(part));

/**
 * What to offer under a search box: popular searches that begin with the text, states and categories whose names
 * begin with it (not in the 7-day store, which has no states), then the text with its last word completed. An empty
 * box offers the popular searches. At most `limit`, no label twice.
 */
export function suggest(text: string, hints: SearchHints, opts: { limit?: number; quick?: boolean } = {}): Suggestion[] {
  const limit = opts.limit ?? 8;
  const words = searchWords(text);
  const typed = words.join(' ');
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const add = (s: Suggestion): void => {
    const key = `${s.kind}:${s.label.toLowerCase()}`;
    if (out.length < limit && !seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  };
  if (!typed) {
    for (const q of hints.popular.slice(0, Math.min(limit, 6))) add({ kind: 'search', label: q, query: q });
    return out;
  }
  const ended = /\s$/.test(text);
  const last = ended ? '' : (words.at(-1) ?? '');
  const head = (ended ? words : words.slice(0, -1)).join(' ');

  for (const q of hints.popular) {
    if (q.startsWith(typed) && q !== typed) add({ kind: 'search', label: q, query: q });
    if (out.length >= 2) break;
  }
  if (!opts.quick && typed.length >= 2) {
    // a state by its name or by its people's ("punjabi"), through the synonym groups that hold its name
    const aliases = (name: string): string[] => {
      const own = searchWords(name);
      return [...own, ...hints.synonyms.filter((g) => g.some((w) => own.includes(w))).flat()];
    };
    const states = hints.regions
      .filter((r) => r.name.toLowerCase().startsWith(typed) || (!head && aliases(r.name).some((w) => w.startsWith(last))))
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
    for (const r of states) add({ kind: 'state', label: r.name, slug: r.slug, count: r.count });
    if (typed.length >= 3) {
      const cats = hints.categories
        .filter((c) => c.name.toLowerCase().startsWith(typed) || (!head && startsAWord(c.name, last)))
        .slice(0, 2);
      for (const c of cats) add({ kind: 'category', label: c.name, type: c.type, slug: c.slug, count: c.count });
    }
  }
  // a word that is a state already offered goes to the state, not to a search for its name
  const states = new Set(out.filter((s) => s.kind === 'state').map((s) => s.label.toLowerCase()));
  for (const w of complete(last, hints.words, limit)) {
    const query = head ? `${head} ${w}` : w;
    if (!states.has(query)) add({ kind: 'search', label: query, query });
  }
  return out;
}

const strings = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : []);
const objects = (x: unknown): Record<string, unknown>[] =>
  Array.isArray(x) ? x.filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null) : [];

/** The hints as the browser receives them, checked by hand (zod stays off the store's pages): anything odd is dropped. */
export function parseHints(x: unknown): SearchHints {
  if (typeof x !== 'object' || x === null) return EMPTY_HINTS;
  const o = x as Record<string, unknown>;
  return {
    words: strings(o.words),
    synonyms: Array.isArray(o.synonyms) ? o.synonyms.map(strings).filter((g) => g.length > 1) : [],
    categories: objects(o.categories).flatMap((c) =>
      typeof c.slug === 'string' && typeof c.name === 'string' && isProductType(c.type)
        ? [{ type: c.type, slug: c.slug, name: c.name, count: Number(c.count) || 0 }]
        : [],
    ),
    regions: objects(o.regions).flatMap((r) =>
      typeof r.slug === 'string' && typeof r.name === 'string' ? [{ slug: r.slug, name: r.name, count: Number(r.count) || 0 }] : [],
    ),
    popular: strings(o.popular),
  };
}
