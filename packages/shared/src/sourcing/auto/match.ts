import type { Offer, SourcingTarget } from './types';

/**
 * Does a shop's result stand for the target, and how well (D-118)? A title must carry the target's words (its
 * `must_match` alternatives, else every word of the query) and no "form" word the target doesn't have: a search for
 * rajma also returns rajma masala, a search for a saree also returns saree covers. Pure, no I/O.
 */

const STOP = new Set([
  'and',
  'with',
  'for',
  'the',
  'of',
  'in',
  'from',
  'by',
  'a',
  'an',
  'to',
  'pack',
  'combo',
  'set',
  'pcs',
  'pc',
  'g',
  'gm',
  'gms',
  'kg',
  'ml',
  'l',
  'x',
  'premium',
  'best',
  'quality',
  'original',
  'authentic',
  'online',
  'buy',
]);

/** Words that make a different product of the same thing. */
const FORM_WORDS = [
  'masala',
  'powder',
  'mix',
  'paste',
  'sauce',
  'pickle',
  'chutney',
  'chips',
  'flour',
  'atta',
  'seeds',
  'plant',
  'sapling',
  'toy',
  'keychain',
  'magnet',
  'poster',
  'sticker',
  'book',
  'cover',
  'case',
  'frame',
  'candle',
  'soap',
  'shampoo',
  'perfume',
  'incense',
  'agarbatti',
  'noodles',
  'syrup',
  'squash',
  'face pack',
  'cream',
  'lotion',
  'pin',
  'brooch',
  'hanger',
  'organizer',
  'mould',
  'mold',
  'machine',
  'maker',
  'tray',
  'dupatta',
  'stole',
  'shawl',
  'kurta',
  'saree',
  'lehenga',
  'dress',
  'shirt',
  'jacket',
  'cap',
  'mask',
  'cushion',
  'bedsheet',
  'curtain',
  'earring',
  'necklace',
  'bangle',
];

const fold = (word: string): string => (word.length > 3 ? word.replace(/(es|s)$/, '') : word);

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w))
    .map(fold);
}

const hasPhrase = (text: string, phrase: string): boolean =>
  new RegExp(`(^|[^a-z])${phrase.replace(/ /g, '[^a-z]+')}(es|s)?([^a-z]|$)`, 'i').test(text);

function mustMatch(target: SourcingTarget): RegExp | null {
  if (!target.must_match) return null;
  try {
    return new RegExp(target.must_match, 'i');
  } catch {
    return null;
  }
}

export interface TargetMatcher {
  matches(title: string): boolean;
  /** 0..1: how many of the target's words the title has. */
  relevance(title: string): number;
}

export function targetMatcher(target: SourcingTarget): TargetMatcher {
  const pattern = mustMatch(target);
  // a shop's own collection ("collection:kurtis", readers/shopify.ts) is the target: the shop chose what is in it
  if (/^collection:/i.test(target.query.trim()))
    return { matches: (title) => !pattern || pattern.test(title), relevance: () => 1 };
  const queryWords = [...new Set(words(target.query))];
  const nameWords = [...new Set(words(`${target.name} ${target.query}`))];
  const own = `${target.name} ${target.query} ${target.must_match ?? ''}`.toLowerCase();
  const forms = FORM_WORDS.filter((f) => !hasPhrase(own, f));
  return {
    matches(title) {
      const lower = title.toLowerCase();
      if (pattern ? !pattern.test(title) : !queryWords.every((w) => words(lower).includes(w)))
        return false;
      return !forms.some((f) => hasPhrase(lower, f));
    },
    relevance(title) {
      if (nameWords.length === 0) return 0;
      const have = new Set(words(title));
      return nameWords.filter((w) => have.has(w)).length / nameWords.length;
    },
  };
}

/**
 * The order to try results in: relevance first, then how much it sells (reviews), a promised delivery and not being
 * an advert. Price breaks ties (cheaper first) without beating a better-known product.
 */
export function offerScore(offer: Offer, matcher: TargetMatcher): number {
  const popular = offer.ratingCount
    ? (Math.log10(1 + offer.ratingCount) / 4) * ((offer.rating ?? 4) / 5)
    : 0;
  return (
    matcher.relevance(offer.title) * 2 +
    Math.min(popular, 1.2) +
    (offer.deliveryText ? 0.2 : 0) -
    (offer.sponsored ? 0.4 : 0) -
    (offer.pricePaise ? Math.min(offer.pricePaise / 10_000_000, 0.1) : 0.1)
  );
}
