import { z } from 'zod';

import { lookKey } from '../../domain/looks';
import { samePicture, type PhotoPrint } from '../../domain/same-picture';

/**
 * `pnpm sourcing looks` (D-194, docs/plan-look-photos.md Phase 3): which looks of a live listing have no photo, where
 * a shop's page shows one, and what to do with each picture found. Pure; the runner does the reading and writing.
 */

const lookVariantSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  options: z.record(z.unknown()),
  item_key: z.string().nullable(),
  item_url: z.string().nullable(),
  site: z.string().nullable(),
});
const lookPhotoSchema = z.object({
  id: z.string().uuid(),
  storage_path: z.string(),
  variant_id: z.string().uuid().nullable(),
  is_primary: z.boolean(),
});
export const lookPlanSchema = z.object({
  listings: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      source_url: z.string(),
      source_site: z.string().nullable(),
      photos: z.array(lookPhotoSchema),
      variants: z.array(lookVariantSchema),
    }),
  ),
});
export type LookListing = z.infer<typeof lookPlanSchema>['listings'][number];
export type LookVariant = LookListing['variants'][number];

export interface MissingLook {
  look: string;
  /** What the alt text calls it: the options without the size. */
  label: string;
  variants: LookVariant[];
}

const lookLabel = (v: LookVariant): string =>
  Object.entries(v.options)
    .filter(([k, x]) => k !== 'size' && typeof x === 'string')
    .map(([, x]) => x as string)
    .join(' · ');

/** The looks with no photo of their own, the page's own look first: its picture is the one the listing already has. */
export function missingLooks(listing: LookListing, ownKey: string | null): MissingLook[] {
  const looks = new Map<string, MissingLook>();
  for (const v of listing.variants) {
    const look = lookKey(v.options);
    const entry = looks.get(look) ?? { look, label: lookLabel(v), variants: [] };
    entry.variants.push(v);
    looks.set(look, entry);
  }
  if (looks.size < 2) return [];
  const byVariant = new Map(listing.variants.map((v) => [v.id, lookKey(v.options)]));
  for (const p of listing.photos) {
    const tagged = p.variant_id ? byVariant.get(p.variant_id) : undefined;
    if (tagged !== undefined) looks.delete(tagged);
  }
  const isOwn = (m: MissingLook): boolean => ownKey !== null && m.variants.some((v) => v.item_key === ownKey);
  return [...looks.values()].sort((a, b) => Number(isOwn(b)) - Number(isOwn(a)));
}

export type LookMethod = 'page' | 'colour-map' | 'swatch' | 'item' | 'item-page';

/**
 * Whether a look is the page's own: its picture is the page's own (`page`), or one of its items is the listing's address.
 * Amazon may open a listing's address on another colour than the address's item (clothing dry run 2026-11-09: 12 of 20
 * listings), so the page's own picture counts whatever the address says.
 */
export function isOwnLook(m: MissingLook, method: LookMethod | null, sourceUrl: string, ownKey: string | null): boolean {
  return method === 'page' || m.variants.some((v) => v.item_url === sourceUrl || (ownKey !== null && v.item_key === ownKey));
}

export interface LookImages {
  urls: string[];
  method: LookMethod;
}

/** What an Amazon page says about its looks (pages.ts `amazonLookData`). */
export interface AmazonLookRaw {
  asin: string | null;
  main: string | null;
  /** The image block's colour → photos, when the page carries it. */
  colourImages: Record<string, string[]>;
  swatches: { asin: string; image: string | null }[];
}

/** A swatch's address without its size token (`._SS40_`, `._AC_SR38,50_`): the photo at its own size. */
export const amazonFullSize = (url: string): string => url.replace(/\._[^./]*_\.(jpe?g|png|webp)/i, '.$1');

const sameWord = (a: unknown, b: string): boolean =>
  typeof a === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Each missing look's photos on an Amazon page: the page's own, then the colour map, then the swatches. */
export function amazonLookImages(raw: AmazonLookRaw, missing: MissingLook[]): Map<string, LookImages> {
  const out = new Map<string, LookImages>();
  const swatch = new Map(raw.swatches.filter((s) => s.image).map((s) => [s.asin, s.image!]));
  for (const m of missing) {
    if (raw.main && raw.asin && m.variants.some((v) => v.item_key === raw.asin)) {
      out.set(m.look, { urls: [raw.main], method: 'page' });
      continue;
    }
    const colour = Object.keys(raw.colourImages).find((c) => m.variants.some((v) => sameWord(v.options.colour, c)));
    const mapped = colour ? raw.colourImages[colour] : undefined;
    if (mapped?.length) {
      out.set(m.look, { urls: mapped, method: 'colour-map' });
      continue;
    }
    const thumb = m.variants.map((v) => (v.item_key ? swatch.get(v.item_key) : undefined)).find(Boolean);
    if (thumb) out.set(m.look, { urls: [amazonFullSize(thumb)], method: 'swatch' });
  }
  return out;
}

export type LookAction = 'tag' | 'same-as-other' | 'too-small' | 'add' | 'own-look';

/** A stored photo's print and whose it is: null for a shared photo, else the look it is tagged to. */
export interface StoredPrint {
  id: string;
  print: PhotoPrint | null;
  look: string | null;
}

/** Under this on the short side a photo looks broken at the page's 1200-pixel copy. */
export const MIN_LOOK_PHOTO_PX = 600;

/**
 * What a picture is to the listing: a shared photo already stored becomes this look's (no upload), a picture another
 * look already has says nothing about this look (the shop uses one picture for every pack), and only a new picture
 * big enough is stored.
 */
export function lookAction(
  print: PhotoPrint,
  stored: StoredPrint[],
  own?: { mainId: string | null },
): { action: LookAction; photo?: string } {
  const same = stored.filter((s) => s.print && samePicture(print, s.print));
  const shared = same.find((s) => s.look === null);
  if (shared) return { action: 'tag', photo: shared.id };
  // The page's own look already has the listing's photos, often made again by the photo redo (D-164), so the shop's
  // picture no longer matches them. Its main photo becomes the look's instead; nothing is ever stored for it.
  if (own) {
    const main = stored.find((s) => s.id === own.mainId && s.look === null);
    return main ? { action: 'tag', photo: main.id } : { action: 'own-look' };
  }
  if (same.length > 0) return { action: 'same-as-other' };
  return { action: Math.min(print.width, print.height) < MIN_LOOK_PHOTO_PX ? 'too-small' : 'add' };
}

/**
 * Whether an error means this machine lost its connection, not that one page failed (the food run of 2026-11-10 stopped
 * on "ENOTFOUND … supabase.co" after Amazon's "net::ERR_FAILED"). A slow page (a timeout) is the page's own failure.
 */
export function isConnectionDown(error: string): boolean {
  return /net::ERR_(FAILED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NETWORK_CHANGED|CONNECTION_(RESET|REFUSED|CLOSED|ABORTED|TIMED_OUT)|ADDRESS_UNREACHABLE)|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|fetch failed|AggregateError|socket hang up/i.test(
    error,
  );
}

export const LOOK_CSV_HEADER = 'listing,look,action,method,media_id,path,bytes';

/** One line of `out/looks-*.csv`, what `--undo` reads back. */
export function lookCsvRow(row: {
  listing: string;
  look: string;
  action: string;
  method?: string | null;
  mediaId?: string | null;
  path?: string | null;
  bytes?: number;
}): string {
  const cell = (x: string): string => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  return [row.listing, row.look, row.action, row.method ?? '', row.mediaId ?? '', row.path ?? '', String(row.bytes ?? 0)]
    .map(cell)
    .join(',');
}

/** The rows of a run's CSV that `--undo` needs: what was added and what was tagged. */
export function lookCsvUndo(csv: string): { added: string[]; tagged: { listing: string; media: string }[] } {
  const added: string[] = [];
  const tagged: { listing: string; media: string }[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')) ?? [];
    const [listing, , action, , media] = cells;
    if (!listing || !media) continue;
    if (action === 'added') added.push(media);
    if (action === 'tagged') tagged.push({ listing, media });
  }
  return { added, tagged };
}
