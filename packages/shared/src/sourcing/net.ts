import { parseComboParts, parseWeightParts, type WeightParts } from './weight';

/**
 * D-202: the net quantity a pack's own words state ("Net Wt. 500 g", "NET WEIGHT : 500g", "नेट वजन 500 ग्राम"), read
 * from a label's transcription, a shop page's bullets or a description. Every packaged food in India must print it
 * (Legal Metrology (Packaged Commodities) Rules, 2011) and online shops must show it, so a number counts only right
 * after one of these words: a label also prints a serving size ("Serving size 25 g") and "per 100 g", which are not
 * the pack.
 */

const NET_WORDS = [
  '(?<![a-z])net\\s*(?:wt|weight|wght|quantity|qty|content|contents|mass|vol(?:ume)?)\\.?(?:\\s*\\(\\s*(?:g|gm|kg)\\s*\\))?',
  // Hindi: shuddh bhaar / shuddh vajan / net vajan / kul maatra / shuddh maatra
  'शुद्ध\\s*(?:भार|वजन|वज़न|मात्रा)',
  'नेट\\s*(?:वजन|वज़न|भार|मात्रा)',
  'कुल\\s*(?:मात्रा|भार|वजन)',
];
const NET_RE = new RegExp(
  `(?:${NET_WORDS.join('|')})\\s*(?:[:\\-–=/|]\\s*)?([^\\n;|]{1,40})`,
  'giu',
);

/** Devanagari digits and Hindi unit words as the weight reader knows them ("५०० ग्राम" is 500 g). */
export function latinNumbers(text: string): string {
  return text
    .replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/\s*(?:कि\.?\s*ग्रा\.?|किलोग्राम|किलो)/g, ' kg')
    .replace(/\s*(?:ग्राम|ग्रा\.?)/g, ' g')
    .replace(/\s*(?:मि\.?\s*ली\.?|मिलीलीटर)/g, ' ml')
    .replace(/\s*लीटर/g, ' l');
}

/** The text after each net word, in order: "500 g", "2 x 200 g (400 g)". */
export function netStatements(text: string): string[] {
  return [...text.matchAll(NET_RE)].map((m) => m[1]!.trim()).filter(Boolean);
}

/** What does not belong to the pack's own quantity, when it sits in the same few words. */
const NOT_THE_PACK = /\b(serving|per\s*100|each\s*serve)/i;

/**
 * The net quantity the text states after a net word, as units ("2 × 200 g"), or null: no net word, or no weight
 * after it. The first statement that reads wins; a statement about a serving is skipped.
 */
export function readNet(text: string | null | undefined): WeightParts[] | null {
  if (!text) return null;
  for (const statement of netStatements(latinNumbers(text))) {
    // one sentence: "Net Wt: 500 g. Serving size 25 g." is 500 g
    const said = statement.split(/\.\s|\s{2,}/)[0]!;
    if (NOT_THE_PACK.test(said)) continue;
    // "200g + 50g free" is the whole pack; else the first weight said ("2 x 200 g (400 g)" is 2 × 200 g)
    const combo = parseComboParts(said);
    if (combo) return combo;
    const one = parseWeightParts(said.split(/[,(]/)[0]!) ?? parseWeightParts(said);
    if (one && one.unitGrams >= 1) return [one];
  }
  return null;
}

/** A line that is a weight and nothing else: "500 g", "100g (3.56 oz)", "50 GRAMS", "1 KG.". */
const WEIGHT_LINE =
  /^\s*(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams|gr|kg|kgs|ml|l|ltr|litre|liter)\.?\s*(?:\([^)]*\))?\s*$/i;

/**
 * D-202, the label reader's front-of-pack test (`--front`): the weights a transcription prints on a line of their
 * own, as a pack's front does without "Net Wt." (843 photos of the backlog). Read only to confirm the vision model's
 * own reading; never alone, since a line "10g" may be protein per serve.
 */
export function weightLines(text: string | null | undefined): WeightParts[] {
  if (!text) return [];
  return latinNumbers(text)
    .split('\n')
    .filter((line) => WEIGHT_LINE.test(line))
    .map((line) => parseWeightParts(line.split('(')[0]!))
    .filter((p): p is WeightParts => p !== null && p.unitGrams >= 1);
}

/** A shop's own line for what one unit holds: Blinkit's "Unit: 1 pc (500 g)", "Weight: 400 g", "Pack size: 2 x 200 g". */
const UNIT_LINE =
  /\b(unit|weight|net quantity|quantity|pack size|size|contents?)\s*[:\-]\s*([^;\n]{1,40}?)(?=\.\s|\.?$|;)/gim;
/** Words that make a weight something other than the pack: a serving, a nutrient. */
const NOT_THE_PACK_TEXT =
  /serving|per\s*100|each\s*serve|per\s*piece|calorie|protein|fib(?:re|er)|sugar/i;

function packParts(text: string): WeightParts[] | null {
  if (NOT_THE_PACK_TEXT.test(text)) return null;
  const combo = parseComboParts(text);
  if (combo) return combo;
  const one = parseWeightParts(text);
  return one && one.unitGrams >= 1 ? [one] : null;
}

/**
 * D-204: what a listing's description says the pack holds without a net word (readNet first): a shop's "Unit: 1 pc
 * (500 g)" line, else its opening "<name>, 1 pack (500 g)." or "<name>, 150 g X 3." (the first sentence counts only
 * when it starts with the listing's name, so prose like "Contains 5 g of fibre" never does).
 */
export function readDescribed(
  text: string | null | undefined,
  name: string,
): { parts: WeightParts[]; how: string } | null {
  if (!text) return null;
  const t = latinNumbers(text);
  for (const m of t.matchAll(UNIT_LINE)) {
    const parts = packParts(m[2]!);
    if (parts) return { parts, how: `its description's ${m[1]!.toLowerCase()} line` };
  }
  const first = t
    .split(/\.\s|\n/)[0]!
    .replace(/\.\s*$/, '')
    .trim();
  const start = name.toLowerCase().slice(0, 12);
  if (!start || !first.toLowerCase().startsWith(start)) return null;
  const parts = packParts(first);
  return parts ? { parts, how: "its description's first sentence" } : null;
}
