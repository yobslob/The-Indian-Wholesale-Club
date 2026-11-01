import {
  avoidWords,
  cleanShopText,
  CONTACT,
  factText,
  MONEY,
  SHOP_NAMES,
  SHOP_TALK,
  shownRows,
  words,
  type DescribeSource,
} from './source';

/**
 * D-178: the deterministic checks every rewrite passes before anyone sees it, so nothing a customer reads gives away
 * a price, the shop or India's side (D-003), states a fact the listing does not (D-012), or copies the shop's text.
 * A failed rewrite is asked again with the reasons, then left for the founder. Pure, no I/O.
 */

export type Rewrite = { summary: string; description: string };

export type CheckResult = {
  pass: boolean;
  /** Each failure in a few words the model and the founder both read ("a number not in the listing: 499"). */
  failures: string[];
  /** Hard failures (money, links, shops, emojis): not even the founder's edit goes out with one. */
  hard: string[];
  /** Share of the prose's four-word runs found in the shop's text (0 – 1) and the longest shared run, in words. */
  overlap: number;
  run: number;
};

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u;
const MARKDOWN = /\*\*|__|^#|`|\[[^\]]*\]\(/m;

/** D-059's words of an ad, which the store's voice never uses. */
const HYPE =
  /\b(vibrant|timeless|rich heritage|curated|exquisite|elevate[sd]?|stunning|must[- ]have|whether you'?re|look no further|perfect(ly)?|beautiful(ly)?|add(s)? a touch|unmatched|luxurious|second to none)\b|\u{2014}|!/iu;

/** Health and medical claims: the shop's, never checked, and not ours to make (D-178). */
const HEALTH =
  /\b(pain[- ]?reliever|pain relief|immunity|immune|antioxidants?|weight loss|lose weight|cures?|heals?|detox\w*|mood booster|boosts? (your )?(mood|energy|metabolism|digestion)|anti[- ]?inflammatory|medicinal|therapeutic|reduces? stress)\b/i;

/** Materials and claims a rewrite may name only when the listing does (an invented "handwoven" or "pure silk"). */
const FACT_WORDS = new Set(
  (
    'cotton silk linen wool woollen woolen pashmina cashmere polyester rayon viscose modal georgette chiffon crepe ' +
    'satin velvet organza lycra spandex denim khadi chanderi banarasi kanjivaram kanchipuram tussar muslin jute ' +
    'leather brass copper bronze steel iron aluminium aluminum wood wooden mdf bamboo cane rattan ceramic porcelain ' +
    'terracotta clay glass marble stone resin plastic acrylic metal handmade handwoven handloom handcrafted ' +
    'handpainted handembroidered handblock organic vegan gluten preservative preservatives artisan artisans ' +
    'authentic certified ayurvedic halal homemade microwave dishwasher eco-friendly sustainable occasion occasions ' +
    'festive festival festivals wedding weddings party parties breathable lightweight stretchable waterproof ' +
    'washable non-stick rust-proof ' +
    // foods and allergens: an invented one is a wrong label (founder's trial: "ghee, saffron, nuts" on a sweet)
    'sugar jaggery ghee butter milk cream curd paneer khoya mawa nuts nut cashew cashews almond almonds pistachio ' +
    'pistachios peanut peanuts walnut saffron cardamom coconut sesame wheat maida besan semolina soy soya egg eggs ' +
    'gelatin honey garlic onion fish shellfish mustard'
  ).split(' '),
);

/** Words a fact line may use without the listing saying them (joining words, plain units and sizes). */
const COMMON = new Set(
  (
    'with without from into that this each both also only very more than other some such pack packs packet ' +
    'packets piece pieces included include includes comes plus about approx size sizes inch inches metre metres ' +
    'meter meters grams gram litre litres days months years regular standard style type made used item items'
  ).split(' '),
);

/** Topics a listing states that a rewrite must keep, unless the rows under the words already show them. */
const TOPICS: [RegExp, string, string][] = [
  [/\bingredients?\s*[:\-–]/i, 'ingredients', 'Ingredients'],
  [/\b(allergen|contains (milk|nuts|gluten|soy))/i, 'allergens', 'Allergens'],
  [
    /\b(hand ?wash|machine ?wash|dry ?clean|wash (it )?(separately|cold)|do not bleach)\b/i,
    'care',
    'Care',
  ],
  [/\b(shelf life|best before)\b/i, 'shelf life', 'Shelf life (days)'],
];

/** The numbers of a text, as written without thousands commas ("1,000" is 1000, "2.50" is 2.5). */
export const numbers = (text: string): string[] =>
  [...text.replace(/(\d),(\d{3})\b/g, '$1$2').matchAll(/\d+(?:\.\d+)?/g)].map((m) =>
    m[0].includes('.') ? String(Number(m[0])) : m[0].replace(/^0+(?=\d)/, ''),
  );

/** A number with its unit (a size, a weight, a count, a share): the listing's facts the rewrite must keep. */
const MEASURES =
  /\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:%|g|gm|gms|grams?|kg|kgs|ml|l|litres?|liters?|m|metres?|meters?|cm|mm|inch(?:es)?|in|ft|feet|pcs|pieces?|days?|months?|years?)\b|\b(?:pack|set|box) of \d+\b/gi;

const grams = (list: string[], n: number): Set<string> =>
  new Set(
    list.slice(0, Math.max(0, list.length - n + 1)).map((_, i) => list.slice(i, i + n).join(' ')),
  );

/** The longest run of words `a` shares with `b`, in words. */
function longestRun(a: string[], b: string[]): number {
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++)
      if (a[i - 1] === b[j - 1]) best = Math.max(best, (row[j] = prev[j - 1]! + 1));
    prev = row;
  }
  return best;
}

/** Capitalised words not opening a sentence, line or bullet value: names, places, festivals the rewrite added. */
function properNames(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const body = line.replace(/^\s*•\s*[^:]{1,40}:\s*/, '');
    for (const sentence of body.split(/(?<=[.!?;:])\s+/)) {
      for (const t of sentence.split(/\s+/).slice(1)) {
        // "Haldiram's", "Hand-Painted": the first letters only
        const w = /\p{L}+/u.exec(t)?.[0] ?? '';
        if (/^\p{Lu}/u.test(w) && w !== 'I') out.push(w);
      }
    }
  }
  return out;
}

/** The checks on what a customer would read (the founder's own edit goes through the same). */
export function checkRewrite(source: DescribeSource, rewrite: Rewrite): CheckResult {
  const failures: string[] = [];
  const hard: string[] = [];
  const fail = (text: string, isHard = false): void => void (isHard ? hard : failures).push(text);
  const { summary, description } = rewrite;
  const all = `${summary}\n${description}`;
  const facts = factText(source);
  const factLower = facts.toLowerCase();

  if (MONEY.test(all)) fail(`talks of money: "${MONEY.exec(all)![0]}"`, true);
  if (CONTACT.test(all)) fail(`a link, email or phone: "${CONTACT.exec(all)![0]}"`, true);
  if (EMOJI.test(all)) fail('an emoji or symbol', true);
  if (SHOP_NAMES.test(all)) fail(`names a shop: "${SHOP_NAMES.exec(all)![0]}"`, true);
  if (SHOP_TALK.test(all)) fail(`talks of selling or shipping: "${SHOP_TALK.exec(all)![0]}"`, true);
  for (const w of avoidWords(source))
    if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(all))
      fail(`names the brand or shop: "${w}"`, true);

  const known = new Set(numbers(facts));
  const added = [...new Set(numbers(all).filter((n) => !known.has(n)))];
  if (added.length)
    fail(
      `a number not in the listing: ${added.join(', ')} (write only numbers the shop states, never work one out)`,
    );
  // the shop's own words' measures (the name's stay in the name; the rows show their own)
  const kept = new Set(
    numbers(
      `${all}\n${shownRows(source)
        .map(([, v]) => v)
        .join('\n')}`,
    ),
  );
  const shopFacts = `${cleanShopText(source.summary)}\n${cleanShopText(source.description)}`;
  const lost = [
    ...new Set(
      [...shopFacts.replace(/(\d),(\d{3})\b/g, '$1$2').matchAll(MEASURES)].map((m) => m[0]),
    ),
  ]
    .filter((m) => !numbers(m).every((n) => kept.has(n)))
    .slice(0, 6);
  if (lost.length) fail(`a fact left out: ${lost.join(', ')}`);
  const rows = new Set(shownRows(source).map(([k]) => k));
  for (const [re, name, row] of TOPICS)
    if (
      re.test(facts) &&
      !rows.has(row) &&
      !re.test(all) &&
      !new RegExp(`\\b${name}\\b`, 'i').test(all)
    )
      fail(`the ${name} left out`);

  const invented = [...new Set(words(all).filter((w) => FACT_WORDS.has(w)))].filter(
    (w) =>
      !factLower
        .replace(/\bhand[\s-]+(?=[a-z])/g, 'hand')
        .includes(w.slice(0, Math.max(4, w.length - 3))),
  );
  if (invented.length) fail(`not stated in the listing: ${invented.join(', ')}`);
  const names = [...new Set(properNames(all))].filter((n) => !factLower.includes(n.toLowerCase()));
  if (names.length) fail(`a name not in the listing: ${names.slice(0, 5).join(', ')}`);

  const [intro = '', ...rest] = description.split(/\n{2,}/);
  const bullets = rest.join('\n').split('\n').filter(Boolean);
  if (summary.length < 20 || summary.length > 160 || summary.includes('\n'))
    fail('the summary is not one short line');
  if (intro.length < (facts.length < 120 ? 25 : 60) || intro.length > 520)
    fail('the paragraph is too short or long');
  if (description.length > 1800 || bullets.length > 8) fail('too long');
  // an ingredients or allergens list is kept whole, however long (D-178: every fact kept)
  const lineOk = (b: string): boolean =>
    /^• [^:\n]{1,40}: [^:\n]+$/.test(b) &&
    b.length <= (/^• (ingredients|allergens?|contains)/i.test(b) ? 900 : 200);
  // a fact line states what the listing states: most of its words are the listing's, an ingredients or allergens
  // line every one of them
  const ungrounded = bullets.filter((b) => {
    const [, label = '', value = ''] = /^• ([^:]+): (.*)$/.exec(b) ?? [];
    const content = words(value).filter((w) => w.length >= 4 && !/\d/.test(w) && !COMMON.has(w));
    const found = content.filter((w) => factLower.includes(w.slice(0, Math.max(4, w.length - 2))));
    return /ingredient|allergen|contains/i.test(label)
      ? found.length < content.length
      : content.length > 0 && found.length / content.length < 0.5;
  });
  if (ungrounded.length)
    fail(`a fact line the listing does not state: "${ungrounded[0]!.slice(2, 70)}" (leave it out)`);
  if (!bullets.every(lineOk))
    fail('a fact with a second colon or too long: give each fact its own short line');
  if (MARKDOWN.test(all)) fail('markdown');
  if (HYPE.test(all)) fail(`ad words: "${HYPE.exec(all)![0]}"`);
  if (HEALTH.test(all)) fail(`a health claim: "${HEALTH.exec(all)![0]}"`);
  if (description.replace(/\s+/g, ' ').startsWith(summary.replace(/[.…]+$/, '').trim()))
    fail('the paragraph starts like the summary');

  // facts may keep the shop's words; the prose must be the store's own (D-178)
  const shop = words(`${source.summary ?? ''}\n${source.description ?? ''}`);
  const prose = words(`${summary}\n${intro}`);
  const shopGrams = grams(shop, 4);
  const proseGrams = [...grams(prose, 4)];
  const overlap = proseGrams.length
    ? proseGrams.filter((g) => shopGrams.has(g)).length / proseGrams.length
    : 0;
  const run = longestRun(prose, shop);
  if (overlap > 0.2 || run > 7)
    fail(
      `the summary or paragraph copies the shop (${Math.round(overlap * 100)} %, ${run} words in a row): say it your way`,
    );
  // a fact line may keep the shop's words for its facts (an ingredients list), not a whole sentence of its prose
  const copied = bullets.filter((b) => {
    const value = words(b.replace(/^• [^:]*: /, ''));
    const g = [...grams(value, 4)];
    return (
      !/^• ingredients/i.test(b) &&
      value.length >= 12 &&
      g.filter((x) => shopGrams.has(x)).length / g.length > 0.6
    );
  });
  if (copied.length) fail(`a fact line copies the shop's sentence: "${copied[0]!.slice(2, 60)}…"`);

  return {
    pass: !failures.length && !hard.length,
    failures: [...hard, ...failures],
    hard,
    overlap,
    run,
  };
}
