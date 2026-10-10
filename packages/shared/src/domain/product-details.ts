import { clothingAttributesSchema, spiceAttributesSchema } from './attributes';

/**
 * The product page's "Details" rows (website and app): the attributes customers may see (D-003; invalid data is not
 * shown), where the piece is from, and what the photos are (D-100). Pure, so both apps draw the same rows.
 */
export type DetailsInput = {
  product_type: 'clothing' | 'spice';
  attributes: unknown;
  region_name: string;
};

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
  } else {
    const parsed = spiceAttributesSchema.safeParse(product.attributes);
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
  rows.push(['Made in', `India, from ${product.region_name}`]);
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
