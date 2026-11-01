import type { ProductType } from '../../domain';

/**
 * D-178: a listing's words as the description redo reads them, and the shop's text made safe to show a model: the
 * sentences about prices, offers, links, disclaimers and the shop's photos are cut before it ever sees them, so no
 * number from them can come back (the checks only accept numbers this cleaned text has). Pure, no I/O.
 */

export type DescribeSource = {
  type: ProductType;
  name: string;
  category: string;
  wears: string | null;
  attributes: Record<string, unknown>;
  summary: string | null;
  description: string | null;
  /** Worker only, never shown: the shop's own title and the shop's name, so neither is ever written. */
  shop_title?: string | null;
  shop?: string | null;
  /** The country the piece is made in (D-171): words may say India or Indian only when it is India. */
  made_in?: string | null;
};

/** The shops IWC has read and other marketplaces; never named on a customer surface (D-003). */
export const SHOP_NAMES =
  /\b(amazon|flipkart|myntra|blinkit|grofers|zepto|big ?basket|instamart|swiggy|jiomart|meesho|ajio|nykaa|snapdeal|tata ?cliq|firstcry|savana|newme|oyela|offduty|nishorama|etsy|ebay|shopify|indiamart)\b/i;

/** A sentence about money: a price, MRP, a discount, an offer. */
export const MONEY =
  /₹|\$\s*\d|\brs\.?\s*\d|\b(inr|usd|mrp)\b|\d\s*%\s*off\b|\b(discount|cashback|coupon|price[ds]?|pricing|offers?|deals?|sale|save \d)\b/i;

/** A link, an email address or a phone number. */
export const CONTACT =
  /https?:|www\.|\b[\w-]+\.(com|in|co|net|org|shop|store)\b|[\w.]+@[\w-]+\.|\+91|\b\d{10}\b|\b\d{3,5}[ -]\d{3}[ -]\d{3,4}\b/i;

/** The shop's selling, shipping and returns, India logistics, and notes about its own photos or model. */
export const SHOP_TALK =
  /\b(sellers?|sold by|vendors?|warehouse|dispatch(ed)?|ships?|shipping|shipped|deliver(y|ed|s)?|courier|doorstep|returns?|returnable|refunds?|exchange|replacement|warranty|in stock|out of stock|add to cart|buy now|order now|cash on delivery|cod)\b/i;

const NOISE =
  /disclaimer|do not rely solely|representational purposes?|read (the )?(batch|label)|modell?ing purpose|model (\([^)]*\) )?(is )?wearing|model'?s? (height|size)|(colou?r|product|shade)s? may (slightly )?vary|due to (the )?(lighting|screen)|actual (colou?r|product)|images? (are|is) for|for combo items/i;

const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/** One line of shop text without its emojis, mojibake question marks and runs of spaces. */
const tidyLine = (line: string): string =>
  line
    .replace(EMOJI, ' ')
    .replace(/\?{2,}|&\?+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1')
    .trim();

/** The shop's words with every sentence about money, links, selling and its photos cut, line by line. */
export function cleanShopText(text: string | null | undefined): string {
  return (text ?? '')
    .split(/\n+/)
    .map((line) =>
      tidyLine(line)
        .split(/(?<=[.!?])\s+/)
        .filter((s) => !MONEY.test(s) && !CONTACT.test(s) && !NOISE.test(s) && !SHOP_TALK.test(s))
        .join(' ')
        .trim(),
    )
    .filter((line) => line && !/^[\s•\-–:;,.|]*$/.test(line))
    .join('\n');
}

/** The attributes customers already see under the words (product-details.ts detailRows), as label and text. */
export function shownRows(source: Pick<DescribeSource, 'attributes'>): [string, string][] {
  const a = source.attributes ?? {};
  const label: Record<string, string> = {
    fibre_content: 'Fabric',
    care: 'Care',
    material: 'Material',
    dimensions: 'Size',
    ingredients: 'Ingredients',
    allergens: 'Allergens',
    shelf_life_days: 'Shelf life (days)',
    storage: 'Storage',
    notes: 'Notes',
  };
  return Object.entries(label).flatMap(([key, name]) => {
    const v = a[key];
    const text = Array.isArray(v)
      ? v.join(', ')
      : typeof v === 'string' || typeof v === 'number'
        ? String(v)
        : '';
    return text.trim() ? [[name, text.trim()] as [string, string]] : [];
  });
}

/** Everything a rewrite may draw its facts from: the cleaned shop text, the name, category and shown rows. */
export function factText(source: DescribeSource): string {
  return [
    source.name,
    source.category,
    cleanShopText(source.summary),
    cleanShopText(source.description),
    ...shownRows(source).map(([k, v]) => `${k}: ${v}`),
    // the page shows where it is made (D-004); the words may say so too, never more
    source.made_in === 'India' ? 'Made in India (Indian)' : '',
  ].join('\n');
}

/** Lowercase words of a text, hyphens and "hand made" joined ("handmade"), for comparing two texts' words. */
export const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/\bhand[\s-]+(?=[a-z])/g, 'hand')
    .replace(/[^\p{L}\p{N}%.]+/gu, ' ')
    .replace(/(?<!\d)\.|\.(?!\d)/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/**
 * Words the rewrite must never write: the shop's name and, for clothing and home, the brand (D-143; food keeps its
 * brand, D-139): the shop title's first word when the IWC name dropped it, and a name's leading capitals ("KALINI").
 */
export function avoidWords(source: DescribeSource): string[] {
  const out = new Set<string>();
  for (const w of (source.shop ?? '').split(/\s+/))
    if (w.length > 2 && !/^(the|shop|store)$/i.test(w)) out.add(w);
  if (source.type !== 'food') {
    const first = (source.shop_title ?? '').trim().split(/\s+/)[0] ?? '';
    if (
      first.length > 2 &&
      !words(source.name).includes(first.toLowerCase()) &&
      /^[A-Z]/.test(first)
    )
      out.add(first);
    for (const title of [source.name, source.shop_title ?? '']) {
      const lead = /^((?:[A-Z][A-Z&'.]{1,}\s+){1,3})/.exec(`${title.trim()} `)?.[1]?.trim();
      if (lead && !/^(XL|XXL|XS|OM|UV|LED|MDF|DIY)$/.test(lead)) out.add(lead);
    }
  }
  return [...out];
}
