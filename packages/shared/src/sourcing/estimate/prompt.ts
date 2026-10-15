import { z } from 'zod';

import { detailLines, type EstimateListing, type ReferenceItem, type WeightGroup } from './plan';

/**
 * D-131: what the local model is asked, and how its answer is read. It weighs one unit as shipped, part by part (the
 * code adds the parts, so the sum is never a model's arithmetic), with a range it is 90% sure of. The typical weights
 * below are Claude's rules of thumb (D-131), not measurements: the hub's scale corrects them through the references.
 */

/** What things weigh: shared by both questions, so the second look checks the parts, not the knowledge. */
const TYPICAL = `Typical weights of the goods alone (adult size; kids half to two thirds):
- women: cotton kurta 150-250 g, rayon or georgette kurta 120-200 g, palazzo or pants 120-200 g, cotton dupatta 100-150 g, chiffon dupatta 60-100 g, cotton saree with blouse piece 450-650 g, georgette or chiffon saree 350-500 g, Banarasi or Kanjivaram silk saree 700-1100 g, lehenga choli 1200-2500 g, blouse 80-150 g.
- men: kurta 200-300 g, pyjama 150-250 g, Nehru jacket 250-400 g, sherwani set 1300-2200 g, dhoti or mundu 200-400 g, shirt 180-280 g.
- shawls and stoles: pashmina or fine wool 150-300 g, wool or acrylic shawl 300-500 g, stole 80-150 g.
- Heavy fabric (silk with zari, brocade, velvet, wool, denim) and heavy work (embroidery, sequins, mirrors, stones) sit at the top of a range or above it; plain light fabric at the bottom. For several sizes, weigh a middle size.
- Food: the label's net quantity is the contents (1 ml of oil or ghee is about 0.9 g, of honey about 1.4 g); the container is a part: glass jar 150-400 g, plastic jar or bottle 20-60 g, pouch 5-20 g, tin 50-150 g, paper box 20-60 g.
- Home: material and size. Brass, copper, stone, marble and cast iron are heavy; wood is medium; paper, cloth and cane are light.`;

export const ESTIMATE_SYSTEM = `You estimate shipping weights for an Indian store that sends goods to the US. Prices are worked out from the weight, so be realistic: neither cautious nor generous.
For each numbered option, weigh ONE unit as it is shipped: the item or items in their own retail packaging, not the courier's outer carton.
- parts: only the goods themselves, each with its weight in grams (a kurta set: kurta, pyjama, dupatta; food: the contents, and its jar, tin or bottle as a part). "Pack of 3" is three of the item. Never put packing in parts.
- packaging_g: the retail packing around it all: a folded garment's poly bag and tag 20-40 g, a box 60-150 g, a gift box 150-400 g, bubble wrap for glass or brass 30-80 g.
- low_g and high_g: the packed total you are 90% sure lies between. Narrow for a standard item; wide when size, quantity or material is unclear (fabric sold by the metre with no length stated, a set whose pieces are not named).
${TYPICAL}
Known weights of similar items, when listed, were measured: stay close to them unless this listing clearly differs (more pieces, a bigger size, another material).
Answer with JSON only.`;

/**
 * The second look: one number per option, without parts, asked alongside. Two ways of weighing that disagree by more
 * than 30% mean the model is guessing, whatever range it gave (a "Kota Doria fabric" at 1.58 kg, sure of itself).
 * It reads the same typical weights: without them it answered in round guesses (a mundu "3 kg", a kurta "500 g").
 */
export const QUICK_SYSTEM = `You know what goods from India weigh when shipped. For each numbered option, give the shipping weight in grams of ONE unit with its retail packing, as one number: think of everything in the unit (every piece of a set, the jar of a food), then answer.
${TYPICAL}
Answer with JSON only.`;

/** One number for each of the n options (the schema holds the model to n: it once answered "[]"). */
export const quickAnswerSchema = (n: number) => ({
  type: 'object',
  properties: { grams: { type: 'array', items: { type: 'integer' }, minItems: n, maxItems: n } },
  required: ['grams'],
});

/** The second look's grams per group, in order; null where it gave none. */
export function readQuick(raw: string, groupCount: number): (number | null)[] {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Array.from({ length: groupCount }, () => null);
  }
  const parsed = z.object({ grams: z.array(z.coerce.number().finite()) }).safeParse(json);
  return Array.from({ length: groupCount }, (_, i) => {
    const g = parsed.success ? parsed.data.grams[i] : undefined;
    return g !== undefined && g >= 1 && g <= 50_000 ? Math.round(g) : null;
  });
}

/** The second look's question: the listing without the known weights, so its answer stands on its own. */
export function quickPrompt(listing: EstimateListing, groups: WeightGroup[]): string {
  return [
    `Listing: ${listing.name}`,
    `Kind: ${listing.product_type} / ${listing.category}`,
    ...detailLines(listing),
    'Options:',
    ...groups.map((g, i) => `${i + 1}. ${g.label}`),
  ].join('\n');
}

/**
 * The JSON shape the model must answer in (Ollama's structured output), for n options: at least one part each (it
 * once put a whole 1 l ghee under packaging_g with no parts).
 */
export const estimateAnswerSchema = (n: number) => ({
  type: 'object',
  properties: {
    options: {
      type: 'array',
      minItems: n,
      maxItems: n,
      items: {
        type: 'object',
        properties: {
          option: { type: 'integer' },
          parts: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            items: {
              type: 'object',
              properties: { what: { type: 'string' }, grams: { type: 'integer' } },
              required: ['what', 'grams'],
            },
          },
          packaging_g: { type: 'integer' },
          low_g: { type: 'integer' },
          high_g: { type: 'integer' },
        },
        required: ['option', 'parts', 'packaging_g', 'low_g', 'high_g'],
      },
    },
  },
  required: ['options'],
});

const grams = z.coerce.number().finite().min(0).max(50_000);
const answerSchema = z.object({
  options: z.array(
    z.object({
      option: z.coerce.number().int(),
      parts: z.array(z.object({ what: z.string().max(80).catch('part'), grams })).max(12),
      packaging_g: grams,
      low_g: grams,
      high_g: grams,
    }),
  ),
});

const PACKING =
  /packag|packing|poly ?bag|carton|bubble wrap|^wrap(ping)?$|^(price )?tag$|^box$|gift box/i;

/** A small model sometimes lists the answer's own fields as parts ("low_g 110"). */
const SCHEMA_KEY = /\b(low_g|high_g|packaging_g)\b|^(option|parts|grams|total|sum|subtotal)\b/i;

/** The model's weight for one group: its parts, packaging and range, with the packed total added up here. */
export interface ModelGuess {
  parts: { what: string; grams: number }[];
  packagingG: number;
  packedG: number;
  lowG: number;
  highG: number;
}

/** A known weight shown to the model: what it is and how it was measured. */
export interface ShownReference {
  item: ReferenceItem;
  sim: number;
}

const HOW: Record<ReferenceItem['source'], string> = {
  weighed: 'weighed at the hub',
  admin: 'entered by an admin',
  shop: "the shop's page",
};

/** The question for one listing: its details, the options to weigh, and the known weights most like it. */
export function estimatePrompt(
  listing: EstimateListing,
  groups: WeightGroup[],
  references: ShownReference[],
  pageWeights: string[] = [],
): string {
  const lines = [
    `Listing: ${listing.name}`,
    `Kind: ${listing.product_type} / ${listing.category}`,
    ...detailLines(listing),
    ...pageWeights.map((w) => `A shop's page says: ${w}`),
    'Options to weigh:',
    ...groups.map((g, i) => `${i + 1}. ${g.label}`),
  ];
  if (references.length) {
    lines.push('Known weights of similar items (one unit, packed):');
    for (const r of references)
      lines.push(
        `- "${r.item.name.slice(0, 90)}"${r.item.pack ? ` ${r.item.pack}` : ''}: ${r.item.grams} g (${HOW[r.item.source]})`,
      );
  }
  return lines.join('\n');
}

/**
 * The model's answer per group, in group order; null for a group it left out or answered with nonsense (a range
 * that does not hold a positive total).
 */
export function readAnswer(raw: string, groupCount: number): (ModelGuess | null)[] {
  const out: (ModelGuess | null)[] = Array.from({ length: groupCount }, () => null);
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return out;
  }
  const parsed = answerSchema.safeParse(json);
  if (!parsed.success) return out;
  parsed.data.options.forEach((o, i) => {
    // the option number when it is a valid one, else its place in the answer
    const at = o.option >= 1 && o.option <= groupCount ? o.option - 1 : i;
    if (at >= groupCount || out[at]) return;
    // packing goes in packaging_g only: a part named so would count it twice (a 600 g kurta set came out 1.05 kg)
    const parts = o.parts
      .filter(
        (p) =>
          p.grams > 0 &&
          !SCHEMA_KEY.test(p.what.trim()) &&
          !(o.packaging_g > 0 && PACKING.test(p.what)),
      )
      .map((p) => ({ what: p.what.trim(), grams: Math.round(p.grams) }));
    // no goods, only packing (a pair of jeans "60 g"), is no answer
    if (!parts.length) return;
    const packedG = parts.reduce((sum, p) => sum + p.grams, 0) + Math.round(o.packaging_g);
    // a range that misses the total is widened to hold it
    const lowG = Math.min(Math.round(o.low_g) || packedG, packedG);
    const highG = Math.max(Math.round(o.high_g), packedG);
    out[at] = { parts, packagingG: Math.round(o.packaging_g), packedG, lowG, highG };
  });
  return out;
}
