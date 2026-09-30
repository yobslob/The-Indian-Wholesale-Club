/**
 * Two shorthands for the region files (catalogue/README.md):
 *
 *   c(name, category, colours, sizes, summary, extra)   a clothing listing (colours × sizes = its variants)
 *   p(name, category, packs, summary, extra)             a pantry listing (one variant per pack size)
 *
 * colours / sizes / packs: a set name from sets.mjs, or your own list.
 * extra: { launch: 1–12 (the region's launch pick order), from: 'town' (admin only, never shown),
 *          tier: 'premium' | 'bridal' (placeholder price band), slug: 'own-url-part' }
 */
export function c(name, category, colours, sizes, summary, extra = {}) {
  return { type: 'clothing', name, category, colours, sizes, summary, ...extra };
}

export function p(name, category, packs, summary, extra = {}) {
  return { type: 'spice', name, category, packs, summary, ...extra };
}
