/**
 * Clothing sizes as customers read them (launch QA B-3): shops write the same size many ways ("0-6 M", "6-12 year",
 * "1 - 2 year", "xl", "FREE SIZE"), and the product page showed them in the shop's order. One normaliser for the
 * words and one order for every list (the product page's sizes, the card's ribbon and sheet, See all's filter, the
 * app through `optionAxes`). Display only: the stored option values are never rewritten (D-012). Pure, no I/O.
 */

/** Letter sizes in wearing order (2XL and XXL are the same place). */
const LETTERS = ['XXXS', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL'];
const LETTER_PLACE: Record<string, number> = { '2XL': 7, XXL: 7, XXXL: 9, '3XL': 9 };
const GRAMS: Record<string, number> = { mg: 0.001, g: 1, gm: 1, gms: 1, kg: 1000, ml: 1, l: 1000, ltr: 1000 };

const MONTHS = /^(m|mo|mos|mth|mths|month|months)$/i;
const YEARS = /^(y|yr|yrs|year|years)$/i;
const NUM = '(\\d+(?:\\.\\d+)?)';
const UNIT = '(m|mo|mos|mth|mths|months?|y|yrs?|years?)';
/** "0-6 M", "1 - 2 year", "6–12 Months", "Age 4-5 Yrs", "3-6M", "2 years", "18 M". */
const AGE = new RegExp(`^(?:age\\s*)?${NUM}\\s*(?:(?:-|–|to)\\s*${NUM})?\\s*${UNIT}\\.?$`, 'i');

const tidy = (s: string): string => s.trim().replace(/\s+/g, ' ');
const letterKey = (s: string): string => s.toUpperCase().replace(/\s+/g, '');

/** A kids' age size as months, [from, to]; null for anything else. */
function ageMonths(value: string): [number, number] | null {
  const m = AGE.exec(tidy(value));
  if (!m) return null;
  const per = MONTHS.test(m[3]!) ? 1 : YEARS.test(m[3]!) ? 12 : 0;
  if (!per) return null;
  const from = Number(m[1]) * per;
  return [from, m[2] ? Number(m[2]) * per : from];
}

/**
 * The size as the page shows it: kids' ages in words ("0–6 months", "1–2 years", "3 years"), letter sizes in
 * capitals ("XL"), "Free size" and "One size" in one spelling; anything else as written, spaces tidied.
 */
export function sizeLabel(value: string): string {
  const v = tidy(value);
  const age = AGE.exec(v);
  if (age && (MONTHS.test(age[3]!) || YEARS.test(age[3]!))) {
    const unit = MONTHS.test(age[3]!) ? 'month' : 'year';
    const span = age[2] ? `${age[1]}–${age[2]}` : age[1]!;
    const plural = age[2] || Number(age[1]) !== 1 ? 's' : '';
    return `${span} ${unit}${plural}`;
  }
  const key = letterKey(v);
  if (LETTERS.includes(key)) return key;
  if (/^[a-z0-9]+\/[a-z0-9]+$/i.test(key) && key.split('/').every((p) => LETTERS.includes(p))) return key;
  if (/^free\s*-?\s*size$/i.test(v) || /^free$/i.test(v)) return 'Free size';
  if (/^one\s*-?\s*size$/i.test(v)) return 'One size';
  return v;
}

/**
 * Where a size sorts: [group, number, text]. Groups: letter sizes (0), kids' ages by months, months before years (1),
 * plain numbers (2), numbers with a prefix ("US 9", "W30") kept together by prefix (3), weights (4), the rest in the
 * shop's order (5), free / one size last (6).
 */
export function sizeRank(value: string): [number, number, string] {
  const v = tidy(value).toUpperCase();
  const key = letterKey(v);
  const first = key.split('/')[0]!;
  const letter = LETTER_PLACE[first] ?? LETTERS.indexOf(first);
  if (letter >= 0 && key.split('/').every((p) => LETTERS.includes(p))) return [0, letter, ''];
  if (/^(FREE|ONE\s*-?\s*SIZE)/.test(v)) return [6, 0, ''];
  const age = ageMonths(v);
  // the upper end breaks a tie between two ranges that start together ("0–3 months" before "0–6 months")
  if (age) return [1, age[0] * 1000 + age[1], ''];
  const weight = /^(\d+(?:\.\d+)?)\s*(MG|G|GM|GMS|KG|ML|L|LTR)\b/.exec(v);
  if (weight) return [4, Number(weight[1]) * (GRAMS[weight[2]!.toLowerCase()] ?? 1), ''];
  const num = /(\d+(?:\.\d+)?)/.exec(v);
  if (num) return /^\d/.test(v) ? [2, Number(num[1]), ''] : [3, Number(num[1]), v.replace(/[\d.]+/g, '').trim()];
  return [5, 0, ''];
}

/** Compare two sizes for sorting (stable sorts keep the shop's order where two sizes tie). */
export function compareSizes(a: string, b: string): number {
  const [ga, na, ta] = sizeRank(a);
  const [gb, nb, tb] = sizeRank(b);
  return ga - gb || ta.localeCompare(tb) || na - nb;
}

/** A copy of `items` in size order, read through `sizeOf` (items with no size keep their place at the end). */
export function sortBySize<T>(items: readonly T[], sizeOf: (item: T) => string | null | undefined): T[] {
  const sized = items.map((item, i) => ({ item, i, size: sizeOf(item) }));
  return sized
    .sort((a, b) => {
      if (a.size == null || b.size == null) return a.size == null ? (b.size == null ? a.i - b.i : 1) : -1;
      return compareSizes(a.size, b.size) || a.i - b.i;
    })
    .map((x) => x.item);
}
