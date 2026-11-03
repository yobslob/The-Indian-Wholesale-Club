import { sizeLabel } from './sizes';

/**
 * Shop text as customers read it (launch QA B-9): some listings arrive all in lower case ("rajasthani rajputi
 * poshak", an option "blue"). At display time only, such a title or option label reads in title case; the stored text
 * is never rewritten (D-012), and a title the shop already capitalised is left exactly as it is. Pure, no I/O.
 */

/** Small words stay lower case inside a title ("Kurta with Dupatta", "Set of 2"). */
const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'per', 'the', 'to', 'with', 'x', 'n']);
/** Units stay lower case after a number ("10 g", "2 kg", "500 ml", "5.5 m"). */
const UNITS = new Set(['g', 'gm', 'gms', 'gram', 'grams', 'kg', 'kgs', 'mg', 'ml', 'l', 'ltr', 'litre', 'litres', 'liter', 'liters', 'cm', 'mm', 'm', 'mtr', 'mtrs', 'metre', 'metres', 'in', 'inch', 'inches', 'ft', 'oz', 'lb', 'lbs', 'pc', 'pcs', 'pieces', 'piece']);
/** Letter sizes read in capitals wherever they stand ("Kurta XL"). */
const SIZES = /^(x{0,3}s|m|l|x{1,3}l|[2-6]xl)$/i;
const NUMBER = /^[\d.,/×x-]*\d[\d.,/×x-]*$/i;

/** True when the text has a capitalised word ("Kasavu saree"): the shop chose its case, so it stays. */
const hasCapitalisedWord = (text: string): boolean => /(^|[\s(/"'-])[A-Z][a-z]/.test(text);

/** One word (may hold hyphens or start with a bracket or quote) in title case. */
function titleWord(word: string, first: boolean, afterNumber: boolean): string {
  const bare = word.replace(/^[("'[]+|[)"'\].,:;!?]+$/g, '');
  const lower = bare.toLowerCase();
  if (!bare || /[A-Z]/.test(bare)) return word; // an all-caps brand or code ("IWC", "NEWME") stays
  if (afterNumber && UNITS.has(lower)) return word;
  if (SIZES.test(bare)) return word.replace(bare, bare.toUpperCase());
  if (!first && SMALL.has(lower)) return word;
  if (/^\d/.test(bare)) return word; // "500ml", "3/4th"
  const cased = bare
    .split('-')
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join('-');
  return word.replace(bare, cased);
}

/**
 * A title or option in title case when the shop wrote it all in lower case; any text with a capitalised word is
 * returned as it is. Keeps all-caps words, units after numbers and small words inside the title.
 */
export function displayTitle(text: string): string {
  if (!text || !/[a-z]/.test(text) || hasCapitalisedWord(text)) return text;
  const words = text.split(/(\s+)/);
  let seen = false;
  let prev = '';
  return words
    .map((w) => {
      if (/^\s*$/.test(w)) return w;
      const out = titleWord(w, !seen, NUMBER.test(prev));
      seen = true;
      prev = w;
      return out;
    })
    .join('');
}

/**
 * A variant's label for the page ("blue · 0-6 M" → "Blue · 0–6 months"): each part a size in its one spelling
 * (sizes.ts) or else in title case when it was all lower case.
 */
export function displayOption(label: string): string {
  return label
    .split(' · ')
    .map((part) => {
      const size = sizeLabel(part);
      return size !== part.trim() ? size : displayTitle(part);
    })
    .join(' · ');
}
