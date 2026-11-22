import { formatGrams } from '../../domain/weight';
import { parseComboParts, parseWeightParts, type WeightParts } from '../weight';

import { netGrams } from './food';

/**
 * D-202, the label reader's pack checks (label.ts): one pack's label is not always the option's weight. The eval of
 * 2026-11-20 (200 listings whose weight their own words state) found most of its misses here: Chitale's 1.2 kg is
 * three 400 g packs, a "Combo Kuttu Atta & Singhara Atta" shows one 250 g pack, "Coconut Chutney, 200 gm" a 50 g
 * sachet. Such a reading goes on the sheet, not in the database.
 */

/** "Pack of 3" in an option or a name: the pack count. */
export const PACK_OF = /\b(?:pack|set|combo|box) of (\d{1,2})\b/i;

/** Words that say a listing holds more than one pack. */
const SEVERAL_PACKS =
  /\bcombo\b|\b(?:twin|duo|family) packs?\b|\b([2-9]|\d{2})\s*(?:packs|packets|pouches|jars|bottles|boxes|tins|cans)\b/i;

/**
 * Why one pack's label may not be the option's weight, or null. A pack count the option states is already counted
 * (`count`), as is one the label itself prints ("200 g x 2"); one only the name states is not.
 */
export function severalPacks(
  name: string,
  variant: { label: string; options: Record<string, string> },
  count: number,
  parts: WeightParts[],
): string | null {
  const words = [name, variant.label, ...Object.values(variant.options)];
  const sign = words.map((t) => t.match(SEVERAL_PACKS)?.[0]).find(Boolean);
  if (sign) return `may hold several packs ("${sign}")`;
  const pack = name.match(PACK_OF);
  const said = Number(pack?.[1] ?? 1);
  const onLabel = parts.reduce((n, p) => n + p.count, 0);
  return pack && said > 1 && said !== count && said !== onLabel
    ? `may hold several packs ("${pack[0]}")`
    : null;
}

/** The name's own weight ("Coconut Chutney, 200 gm"; "150gm set of 2" is 300 g) when the label says otherwise. */
export function nameDisagrees(name: string, grams: number): string | null {
  const parts = parseComboParts(name) ?? [parseWeightParts(name)].filter((p) => p !== null);
  if (!parts.length || parts.some((p) => p.unitGrams < 1)) return null;
  const said = netGrams(parts, name);
  return Math.abs(said - grams) > Math.max(said, grams) * 0.02
    ? `the name says ${formatGrams(said)}`
    : null;
}
