import { z } from 'zod';

import { formatGrams } from '../../domain/weight';
import { readNet } from '../net';
import { parseComboParts, parseWeightParts, type WeightParts } from '../weight';

import { netGrams, netLabel, type FoodWrite } from './food';

/**
 * D-202, the label reader: a food listing whose weight nobody read gets the net quantity printed on its own photos
 * (Deepak Jau Sattu's back panel says "NET WEIGHT : 500 g"; it was estimated at 140 g). Two readings of each photo on
 * the founder's laptop (tools/weight-estimator, `pnpm weights labels`): a vision model asked for the net quantity, and
 * a transcription of every word on the photo read by the same rule as a shop page (readNet: only a number right after
 * "Net Wt." and the like, never a serving size). A weight is written only when both say the same, as the label's
 * (source packed, D-135), so customers see it and the price follows (D-128). Anything else goes on the sheet.
 */

/** The vision model's answer about one photo. */
export const labelAnswerSchema = z.object({
  /** Whether the photo shows a pack's printed net quantity at all. */
  shows_net_quantity: z.boolean(),
  /** The net quantity exactly as printed ("500 g", "2 x 200 g"), or null. */
  net_quantity: z.string().nullable(),
});
export type LabelAnswer = z.infer<typeof labelAnswerSchema>;

export const LABEL_SCHEMA = {
  type: 'object',
  properties: {
    shows_net_quantity: { type: 'boolean' },
    net_quantity: { type: ['string', 'null'] },
  },
  required: ['shows_net_quantity', 'net_quantity'],
} as const;

export const LABEL_PROMPT = `This is a product photo of a packaged Indian food.
Find the NET QUANTITY printed on the pack: the words "Net Wt.", "Net Weight", "Net Quantity", "Net Contents",
"शुद्ध भार", "नेट वजन" or "कुल मात्रा" followed by a number and a unit.
Copy it exactly as printed, for example "500 g", "1 kg", "200 g x 2", "400 ml".
Do NOT give the serving size, the weight per 100 g, a nutrition value, a price, a date or a weight that is only in
an advertisement. If no net quantity is printed or you cannot read it clearly, answer shows_net_quantity false and
net_quantity null.`;

export const TRANSCRIBE_PROMPT = `Transcribe every word and number printed on the packs in this photo, line by line,
exactly as printed (English and Hindi). Do not explain, translate or summarise. If there is no printed text, answer
with nothing.`;

/** What was read from one photo. */
export interface PhotoReading {
  path: string;
  variant_id: string | null;
  answer: LabelAnswer | null;
  transcript: string | null;
}

export const labelPlanSchema = z.array(
  z.object({
    product_id: z.string().uuid(),
    name: z.string(),
    category: z.string(),
    shop_price_paise: z.number().int().nullable(),
    variants: z
      .array(
        z.object({
          id: z.string().uuid(),
          label: z.string(),
          options: z.record(z.string()).catch({}),
          weight_g: z.number().int().nullable(),
          weight_source: z.string().nullable(),
          net_qty: z.string().nullable().catch(null),
          is_active: z.boolean(),
          shop_price_paise: z.number().int().nullable(),
        }),
      )
      .nullable()
      .transform((v) => v ?? []),
    photos: z.array(z.object({ path: z.string(), variant_id: z.string().uuid().nullable() })),
  }),
);
export type LabelListing = z.infer<typeof labelPlanSchema>[number];
type LabelVariant = LabelListing['variants'][number];

const total = (parts: WeightParts[]): number =>
  parts.reduce((g, p) => g + p.unitGrams * p.count, 0);

/** The model's words as units: "500 g", "200 g x 2", "100 g + 50 g". */
export function answerParts(answer: LabelAnswer | null): WeightParts[] | null {
  if (!answer?.shows_net_quantity || !answer.net_quantity) return null;
  const combo = parseComboParts(answer.net_quantity);
  if (combo) return combo;
  const one = parseWeightParts(answer.net_quantity);
  return one && one.unitGrams >= 1 ? [one] : null;
}

/** Both readings of a photo, when they agree (within 2%: "500 g" and "500g"); else why not. */
export function agreed(reading: PhotoReading): { parts: WeightParts[] } | { why: string } {
  const seen = answerParts(reading.answer);
  const said = readNet(reading.transcript);
  if (!seen && !said) return { why: 'no net quantity on it' };
  if (!seen || !said) return { why: `only one reader found it (${netLabel((seen ?? said)!)})` };
  const a = total(seen);
  const b = total(said);
  if (Math.abs(a - b) > Math.max(a, b) * 0.02)
    return { why: `the readers disagree (${netLabel(seen)} / ${netLabel(said)})` };
  return { parts: said };
}

const PACK_OF = /\b(?:pack|set|combo|box) of (\d{1,2})\b/i;
const UNCONFIRMED = (v: LabelVariant): boolean =>
  v.is_active &&
  (v.weight_g === null ||
    v.weight_source === null ||
    ['estimated', 'similar'].includes(v.weight_source));

export interface LabelResult {
  listing: LabelListing;
  variant: LabelVariant | null;
  parts: WeightParts[] | null;
  grams: number | null;
  photo: string | null;
  /** read (written), or why not. */
  result: string;
}

/**
 * Which option a photo's net quantity belongs to: the option the photo is tagged with, else the listing's only
 * active option. A listing of several sizes sharing photos is left alone (a 1 kg pack's photo is not the 200 g's).
 * An option "Pack of 3" of a single pack's label is three of it.
 */
export function decideLabel(
  listing: LabelListing,
  readings: PhotoReading[],
  opts: {
    /** Why the price check doubts this weight, or null. */
    doubt?: (listing: LabelListing, variant: LabelVariant, grams: number) => string | null;
    /** The eval: read every active option, also those whose weight is known. */
    every?: boolean;
  } = {},
): LabelResult[] {
  const active = listing.variants.filter((v) => v.is_active);
  const wanted = opts.every ? active : active.filter(UNCONFIRMED);
  const out = new Map<string, LabelResult>();
  const whyNot: string[] = [];
  for (const r of readings) {
    const got = agreed(r);
    if ('why' in got) {
      whyNot.push(got.why);
      continue;
    }
    const target = r.variant_id
      ? wanted.find((v) => v.id === r.variant_id)
      : active.length === 1
        ? wanted[0]
        : undefined;
    if (!target) {
      whyNot.push(
        active.length > 1
          ? 'several options share the photo'
          : 'its option already has a read weight',
      );
      continue;
    }
    if (out.has(target.id)) continue;
    const count = Number(
      Object.values(target.options)
        .concat(target.label)
        .map((t) => t.match(PACK_OF)?.[1])
        .find(Boolean) ?? 1,
    );
    const parts =
      got.parts.length === 1 && got.parts[0]!.count === 1 && count > 1
        ? [{ ...got.parts[0]!, count }]
        : got.parts;
    const grams = netGrams(parts, listing.name);
    if (grams < 1 || grams > 30_000) continue;
    const doubted = opts.doubt?.(listing, target, grams) ?? null;
    out.set(target.id, {
      listing,
      variant: target,
      parts,
      grams,
      photo: r.path,
      result: doubted ? `price check doubts it: ${doubted}` : 'read',
    });
  }
  if (!out.size) {
    const why =
      whyNot.find((w) => w.startsWith('the readers')) ??
      whyNot.find((w) => w.startsWith('only')) ??
      whyNot[0];
    return [
      {
        listing,
        variant: null,
        parts: null,
        grams: null,
        photo: null,
        result: why ?? 'no photo read',
      },
    ];
  }
  return [...out.values()];
}

/** The writes for the readings both readers agree on: the label's net weight and net quantity (D-135). */
export function labelWrites(results: LabelResult[]): FoodWrite[] {
  return results.flatMap((r) =>
    r.result === 'read' && r.variant && r.parts && r.grams
      ? [
          {
            variant_id: r.variant.id,
            weight_g: r.grams,
            note: `Label photo: Net ${netLabel(r.parts)}, both readers agree (D-202)`.slice(0, 200),
            net_qty: netLabel(r.parts),
          },
        ]
      : [],
  );
}

/** For the eval: whether a reading matches a weight already known from the listing's own words. */
export function labelMatches(r: LabelResult): 'same' | 'different' | 'none' {
  if (!r.grams || !r.variant?.weight_g) return 'none';
  return Math.abs(r.grams - r.variant.weight_g) <= r.variant.weight_g * 0.02 ? 'same' : 'different';
}

export const labelSummary = (r: LabelResult): string =>
  r.grams ? `${netLabel(r.parts!)} = ${formatGrams(r.grams)}` : r.result;
