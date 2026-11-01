import { z } from 'zod';

import { avoidWords, cleanShopText, shownRows, type DescribeSource } from './source';

import type { Rewrite } from './checks';

/**
 * D-178: what the local model is asked, and how its answer becomes the listing's words. It answers in three parts
 * (a summary line, a short paragraph, label and value facts) so the format is the code's, never the model's: the
 * store shows the paragraph, then each "• Label: value" line on its own (product-details.tsx). The voice is the
 * store's (docs/storefront.md §Voice, D-059).
 */

export const DESCRIBE_SYSTEM = `You write the product words for an online store in the US that sells clothing, food and home goods from India to people who miss home. You get one listing as a shop wrote it. Write it again, in your own words.

Rules:
- New wording. Never copy the shop's sentences or phrases: say each thing your own way. Facts stay exact: numbers, sizes, lengths, weights, materials, colours, ingredients, care, what is in the set.
- Keep every product fact the shop states. Never add one: no material, place, festival, occasion, use, number or claim (handmade, pure, organic, authentic, natural) the listing does not state. Never work out a number (two 100 g packs stay "2 x 100 g", never "200 g"). If unsure, leave it out.
- Leave out: prices, MRP, discounts, offers, sales, the shop, seller, brand or website names, links, phone numbers, shipping, delivery, returns, stock, disclaimers, anything about the photos or the model wearing it, emojis, health or medical claims (pain relief, immunity, antioxidants, weight loss, stress) and empty praise (premium, high quality, hygienic, best).
- Voice: warm, plain and specific, like a friend from home telling you about it. Short sentences, everyday words. No hype and no ad words: never perfect, beautiful, vibrant, timeless, rich heritage, exquisite, elevate, stunning, luxurious, must-have, "whether you're", "add a touch", "special occasions" (unless the shop says so). No exclamation marks, no dashes as asides.
- summary: one plain sentence of 8 to 20 words saying what it is, ending with a full stop.
- intro: 2 or 3 short sentences: what it is, how it looks, feels or tastes, and how it is worn or used, from the facts only. Do not begin the way the summary begins.
- facts: the concrete facts as short label and value pairs, for example Fabric, Colour, Fit, Length, Width, Sleeves, Neck, In the set, Care, Size, Material, Finish, Ingredients, Net weight, Pack, Spice level, Shelf life, Storage. One fact per pair, its label fitting its value; a value is a plain fact the shop states (a material, a measure, a count, a colour, an ingredient), in normal sentence case, without a colon, never a feeling or praise. No Brand, Origin or Country pair. At most 7. Leave out a fact that is already under "Shown on the page", and one you could only guess.
Answer with JSON only.`;

/** The JSON shape the model must answer in (Ollama's structured output). */
export const describeAnswerSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    intro: { type: 'string' },
    facts: {
      type: 'array',
      maxItems: 7,
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, value: { type: 'string' } },
        required: ['label', 'value'],
      },
    },
  },
  required: ['summary', 'intro', 'facts'],
} as const;

const answer = z.object({
  summary: z.string(),
  intro: z.string(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
});

/** The shop's words a model reads: at most this many characters (the facts come first on a shop's page). */
const MAX_SOURCE = 3000;

/** The question for one listing; `feedback` is why the last answer was not accepted (the checks' failures). */
export function describePrompt(source: DescribeSource, feedback: string[] = []): string {
  const rows = shownRows(source);
  const avoid = avoidWords(source);
  const shop = [cleanShopText(source.summary), cleanShopText(source.description)]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_SOURCE);
  return [
    `Type: ${source.type === 'home' ? 'home & gifts' : source.type}${source.wears ? ` (${source.wears})` : ''}`,
    `Category: ${source.category}`,
    `Name on the page: ${source.name}`,
    rows.length ? `Shown on the page: ${rows.map(([k, v]) => `${k}: ${v}`).join('; ')}` : '',
    avoid.length ? `Never write these names: ${avoid.join(', ')}` : '',
    `The shop's words:\n"""\n${shop || '(none: write only from the name and category, briefly)'}\n"""`,
    feedback.length
      ? `Your last answer was not accepted: ${feedback.join('; ')}. Write it again and fix exactly that.`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const sentenceCase = (s: string): string => s.replace(/^\p{Ll}/u, (c) => c.toUpperCase());

/** The ad words a 7B model keeps writing however often it is told (measured on the trial), made plain. */
const PLAINER: [RegExp, string][] = [
  // an occasion no shop named, tacked onto a sentence's end (the check still catches any other)
  [
    /,?\s*(making it |and is |it is |which is )?(perfect|good|great|ideal|lovely|suitable)? ?for (special|festive|all|any|every) occasions?(?=[.,;]|$)/gi,
    '',
  ],
  [/\bthe perfect (size|length|fit|shape)\b/gi, 'the right $1'],
  [/\b(a |the )?perfect (fit|choice|gift|addition|companion) for\b/gi, '$1good $2 for'],
  [/\bperfect for\b/gi, 'good for'],
  [/\bperfect(ly)?\s+/gi, ''],
  [/\bbeautifully\s+/gi, ''],
  [/\bbeautiful\b/gi, 'lovely'],
];
const flat = (s: string): string =>
  PLAINER.reduce((t, [re, to]) => t.replace(re, to), s)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase());

const EMPTY_VALUE =
  /^(not (specified|applicable|mentioned|stated|available|given)|n\/?a|none|unknown|nil|-+)$/i;
const FLUFF_LABEL =
  /^(aesthetic|appeal|quality|benefits?|highlights?|features?|functionality|usp|look|vibe|brand|origin|country|country of origin|made in|health|health benefits?)$/i;
const PRAISE_ONLY =
  /^((elegant|unique|premium|high[- ]quality|hygienic(ally)?|luxur\w*|royal|stylish|classy|amazing|wonderful|best|great|new|offering|lovely|pretty|attractive|and|&|,|\s)+|new offering)$/i;

/** The model's JSON as the listing's summary and description; null when it is not the shape asked for. */
export function readDescribeAnswer(content: string): Rewrite | null {
  let parsed: z.infer<typeof answer>;
  try {
    parsed = answer.parse(JSON.parse(content));
  } catch {
    return null;
  }
  const seen = new Set<string>();
  const facts = parsed.facts
    .map(
      (f) =>
        [
          sentenceCase(flat(f.label).replace(/[:.]+$/, '')),
          // "Contains: Sulphite" reads as "Contains Sulphite": one colon per line, the label's
          flat(f.value)
            .replace(/:\s*/g, ' ')
            .replace(/[.;,]+$/, ''),
        ] as const,
    )
    // dropping a line never invents anything: an empty or praise-only one, or a label said twice
    .filter(
      ([label, value]) => label && value && !EMPTY_VALUE.test(value) && !FLUFF_LABEL.test(label),
    )
    .filter(
      ([label, value]) =>
        !PRAISE_ONLY.test(value) &&
        !seen.has(label.toLowerCase()) &&
        !!seen.add(label.toLowerCase()),
    )
    .slice(0, 7);
  const intro = flat(parsed.intro);
  const summary = flat(parsed.summary);
  return {
    summary: summary && !/[.?]$/.test(summary) ? `${summary}.` : summary,
    description: [
      intro,
      facts.map(([label, value]) => `• ${label}: ${sentenceCase(value)}`).join('\n'),
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}
