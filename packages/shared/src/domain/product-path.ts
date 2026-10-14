/**
 * Where a product lives (D-121). A product's page is /states/<its state>/<slug>; an all-India listing has no state
 * and lives at /states/india/<slug> (`india` is no state's slug). The store never shows a state it does not have.
 */
export const ALL_INDIA_SLUG = 'india';

/** The state segment of a product's address. */
export const regionSegment = (regionSlug: string | null | undefined): string =>
  regionSlug || ALL_INDIA_SLUG;

/** The website path of a product page. */
export const productPath = (regionSlug: string | null | undefined, slug: string): string =>
  `/states/${regionSegment(regionSlug)}/${slug}`;
