import { clothingAttributesSchema, homeAttributesSchema, foodAttributesSchema } from './attributes';

import type { ProductType } from './product-types';

/**
 * The product page's "Details" rows (website and app): the attributes customers may see (D-003; invalid data is not
 * shown), where the piece is from, and what the photos are (D-100). Pure, so both apps draw the same rows.
 */
export type DetailsInput = {
  product_type: ProductType;
  attributes: unknown;
  /** Empty for an all-India listing (D-121): "India", no state. */
  region_name: string | null;
  /** D-133: food's net quantity (netQuantity), shown first among its rows. */
  net_quantity?: string | null;
};

/**
 * D-133: a food piece's net quantity as its label states it, for the Details rows: each option's ("400 g"), else its
 * pack ("200 g"), each once ("200 g, 1 kg"); null when none is known. Never the packed weight (pricing only).
 */
export function netQuantity(
  variants: { options: Record<string, unknown>; net_qty?: string | null }[],
): string | null {
  const all = variants
    .map((v) => v.net_qty ?? (typeof v.options.pack === 'string' ? v.options.pack : null))
    .filter((q): q is string => !!q);
  const once = [...new Set(all)];
  return once.length ? once.slice(0, 4).join(', ') : null;
}

/** Whether any photo is AI-generated (D-101) and whether any is a real photo (the close-up). */
export type PhotoNote = { ai: boolean; real: boolean };

export function photoNote(media: { is_ai: boolean }[]): PhotoNote {
  return { ai: media.some((m) => m.is_ai), real: media.some((m) => !m.is_ai) };
}

export function detailRows(product: DetailsInput, photos: PhotoNote): [string, string][] {
  const rows: [string, string][] = [];
  if (product.product_type === 'clothing') {
    const parsed = clothingAttributesSchema.safeParse(product.attributes);
    if (parsed.success) {
      rows.push(['Fabric', parsed.data.fibre_content], ['Care', parsed.data.care]);
      if (parsed.data.notes) rows.push(['Notes', parsed.data.notes]);
    }
  } else if (product.product_type === 'home') {
    const parsed = homeAttributesSchema.safeParse(product.attributes);
    if (parsed.success) {
      rows.push(['Material', parsed.data.material]);
      if (parsed.data.dimensions) rows.push(['Size', parsed.data.dimensions]);
      if (parsed.data.care) rows.push(['Care', parsed.data.care]);
      if (parsed.data.notes) rows.push(['Notes', parsed.data.notes]);
    }
  } else {
    if (product.net_quantity) rows.push(['Net quantity', product.net_quantity]);
    const parsed = foodAttributesSchema.safeParse(product.attributes);
    if (parsed.success) {
      const a = parsed.data;
      rows.push(
        ['Ingredients', a.ingredients],
        ['Allergens', a.allergens.length > 0 ? a.allergens.join(', ') : 'None declared'],
        ['Shelf life', `${a.shelf_life_days} days`],
      );
      if (a.storage) rows.push(['Storage', a.storage]);
    }
  }
  rows.push(['Made in', product.region_name ? `India, from ${product.region_name}` : 'India']);
  if (photos.ai) {
    rows.push([
      'Photos',
      photos.real
        ? 'The photos on a model are AI-generated from real photos of this piece; the close-up is a real photo.'
        : 'The photos on a model are AI-generated from real photos of this piece.',
    ]);
  }
  return rows;
}

// ---------------------------------------------------------------- the shop's specs (D-140, plan L4)

/** Keys of more than one word that shops use; any other key is the last word before its colon. */
const LONG_KEYS = /(technical details|wash care|material (?:&|and) care|sleeve length|sleeve type|neck type|pattern type|occasion type|size (?:&|and) fit|product details|country of origin|net quantity|shelf life|in the box)$/i;

/**
 * A shop's run-together specs ("Composition: 100% Cotton Gauze Fit: Fitted at bust Length: Calf"), as their pairs;
 * null when the text is not mostly specs. The store lists them in Details instead of using them as the summary.
 */
export function specPairs(text: string | null | undefined): [string, string][] | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  const colons = [...t.matchAll(/:\s+/g)].map((m) => m.index ?? 0);
  if (colons.length < 2) return null;
  const keys = colons.map((at) => {
    const before = t.slice(0, at);
    const long = LONG_KEYS.exec(before);
    const word = /([A-Z][A-Za-z&/()-]*)$/.exec(before);
    const key = long?.[1] ?? word?.[1] ?? null;
    return key ? { key: key.trim(), start: at - key.length, end: at + (t.slice(at).match(/^:\s+/)?.[0].length ?? 1) } : null;
  });
  if (keys.some((k) => k === null) || (keys[0]!.start > 2)) return null;
  const pairs: [string, string][] = keys.map((k, i) => {
    const to = i + 1 < keys.length ? keys[i + 1]!.start : t.length;
    return [k!.key.replace(/^./, (c) => c.toUpperCase()), t.slice(k!.end, to).trim().replace(/[;,.]\s*$/, '')];
  });
  return pairs.every(([, v]) => v.length > 0) ? pairs : null;
}

/** Whether a summary is worth showing: one plain line, not the shop's specs, not the description's start again. */
export function usableSummary(summary: string | null | undefined, description: string | null | undefined): string | null {
  const s = summary?.trim();
  if (!s || specPairs(s)) return null;
  const d = description?.replace(/\s+/g, ' ').trim() ?? '';
  return d.startsWith(s.replace(/\s+/g, ' ').replace(/[.…]+$/, '')) ? null : s;
}
