/**
 * A look is what a variant looks like: its options without `size` (D-194). Navy-S, Navy-M and Navy-L are one look;
 * "Single" and "Family pack" are two. A photo belongs to a look through `product_media.variant_id`: a photo tagged to
 * Navy-M belongs to every Navy variant, and an untagged photo is shared. Pure, for the web, the API and the runner.
 */
import { displayOption } from './display-text';

interface LookVariant {
  id: string;
  options: Record<string, unknown> | null | undefined;
  available?: number;
}
interface LookMedia {
  variant_id: string | null;
  storage_path: string;
}

/** A stable key for a variant's look; '' for options that say nothing but a size. */
export function lookKey(options: Record<string, unknown> | null | undefined): string {
  const o = options ?? {};
  return Object.keys(o)
    .filter((k) => k !== 'size' && typeof o[k] === 'string' && (o[k] as string).trim() !== '')
    .sort()
    .map((k) => `${k}=${displayOption((o[k] as string).trim()).toLowerCase()}`)
    .join('|');
}

/** The distinct looks in variant order. A listing "has looks" when there are two or more. */
export function looksOf(variants: LookVariant[]): string[] {
  return [...new Set(variants.map((v) => lookKey(v.options)))];
}

const lookById = (variants: LookVariant[]): Map<string, string> =>
  new Map(variants.map((v) => [v.id, lookKey(v.options)]));

/**
 * The gallery rule: the look's own photos, then the shared ones, leaving out other looks' photos. A look with no photo
 * of its own, no look chosen, or a listing with one look gets every photo in today's order: never empty, never worse.
 * A photo tagged to a variant that isn't on sale any more counts as shared, so it is never lost.
 */
export function photosForLook<M extends LookMedia>(media: M[], variants: LookVariant[], look: string | null): M[] {
  if (look === null || looksOf(variants).length < 2) return media;
  const looks = lookById(variants);
  const own = media.filter((m) => m.variant_id !== null && looks.get(m.variant_id) === look);
  if (own.length === 0) return media;
  return [...own, ...media.filter((m) => m.variant_id === null || !looks.has(m.variant_id))];
}

/**
 * The look a page opens on: the main photo's, when the main photo is tagged and that look is in stock. Null otherwise,
 * which means the page opens as it did before looks: every photo in today's order and today's first choice. So the
 * first paint and the largest photo stay the same (D-194).
 */
export function initialLook(variants: LookVariant[], media: LookMedia[]): string | null {
  const tag = media[0]?.variant_id;
  if (!tag || looksOf(variants).length < 2) return null;
  const owner = variants.find((v) => v.id === tag);
  if (!owner) return null;
  const look = lookKey(owner.options);
  return variants.some((v) => lookKey(v.options) === look && (v.available ?? 1) > 0) ? look : null;
}

/** The look's first own photo (for the bag and the card), or null: then the listing's main photo stands in. */
export function lookPhoto(look: string, media: LookMedia[], variants: LookVariant[]): string | null {
  if (looksOf(variants).length < 2) return null;
  const looks = lookById(variants);
  return media.find((m) => m.variant_id !== null && looks.get(m.variant_id) === look)?.storage_path ?? null;
}

/** The choices for a photo in the admin panel: each look with its first variant, which its tag points at. */
export function lookChoices(variants: LookVariant[]): { look: string; label: string; variantId: string }[] {
  const seen = new Map<string, { look: string; label: string; variantId: string }>();
  for (const v of variants) {
    const look = lookKey(v.options);
    if (seen.has(look)) continue;
    const words = Object.entries(v.options ?? {})
      .filter(([k, x]) => k !== 'size' && typeof x === 'string')
      .map(([, x]) => displayOption(x as string));
    seen.set(look, { look, label: words.join(' · '), variantId: v.id });
  }
  return seen.size < 2 ? [] : [...seen.values()];
}

/** Each option with its look's photo, for the card's + (`media` holds this listing's tagged photos, first photo first). */
export function withLookPhotos<O extends LookVariant>(
  options: O[],
  media: LookMedia[],
): (O & { image_path: string | null })[] {
  return options.map((o) => ({ ...o, image_path: lookPhoto(lookKey(o.options), media, options) }));
}
