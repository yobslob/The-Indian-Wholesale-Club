import { pictureGroups, sharpest, type ProductType } from '@repo/shared/domain';

import { errorText, log } from './log';
import { photoPrint } from './photo-store';

import type { RunContext } from './context';
import type { Redone } from './redo';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copies a new listing's photos into IWC's own storage (D-110, D-118): customers never load a shop's photo address
 * (D-003). Fetched with the browser's own request context (the shop's cookies, the page as referrer). A photo the
 * shop shows twice (a full-size photo and its preview, D-142) is kept once, at full size, in its first place. With
 * the photo redo service (D-168, redo.ts) the photos are made again first and go up with their mark.
 */
export async function copyPhotos(
  ctx: RunContext,
  productId: string,
  type: ProductType,
  photos: { url: string; itemKey: string | null; alt: string }[],
  referer: string,
): Promise<{ path: string; alt_text: string; item_key?: string; redo?: 'face' | 'fresh' }[]> {
  const got: { photo: (typeof photos)[number]; body: Buffer; type: string }[] = [];
  for (const photo of photos.slice(0, 16)) {
    try {
      const res = await ctx.lanes.browser.request.get(photo.url, {
        timeout: 30_000,
        headers: { referer },
      });
      try {
        const type = res.headers()['content-type'] ?? '';
        if (!res.ok() || !/^image\/(jpeg|png|webp)/.test(type)) continue;
        const body = await res.body();
        if (body.length < 2_000 || body.length > MAX_BYTES) continue;
        got.push({ photo, body, type });
      } finally {
        // Playwright keeps every answer's body until the browser closes unless it is disposed (memory.ts)
        await res.dispose();
      }
    } catch (error) {
      log(`  photo not copied: ${errorText(error)}`);
    }
  }
  const prints = await Promise.all(got.map((g) => photoPrint(g.body)));
  const groups = pictureGroups(prints, got.map((g) => g.photo.itemKey));
  if (groups.length < got.length) log(`  ${got.length - groups.length} photo(s) the shop shows twice, kept once`);
  const chosen = groups.map((group) => {
    const { body, type: contentType } = got[sharpest(group, prints)]!;
    return { photo: got[group[0]!]!.photo, body, type: contentType };
  });
  const redone: Redone[] = ctx.redo ? await redoPhotos(ctx, productId, type, chosen) : chosen;
  const out: { path: string; alt_text: string; item_key?: string; redo?: 'face' | 'fresh' }[] = [];
  for (const [i, { photo }] of chosen.entries()) {
    const { body, type: contentType, redo } = redone[i]!;
    try {
      const path = await ctx.db!.upload(productId, body, contentType);
      out.push({
        path,
        alt_text: photo.alt.slice(0, 200),
        ...(photo.itemKey ? { item_key: photo.itemKey } : {}),
        ...(redo ? { redo } : {}),
      });
    } catch (error) {
      log(`  photo not copied: ${errorText(error)}`);
    }
  }
  return out;
}

/** The listing's photos through the redo service; who wears a clothing piece first (a kids' face is only ever cut). */
async function redoPhotos(
  ctx: RunContext,
  productId: string,
  type: ProductType,
  photos: { body: Buffer; type: string }[],
): Promise<Redone[]> {
  let wears: string | null = null;
  if (type === 'clothing') {
    try {
      wears = await ctx.db!.wears(productId);
    } catch (error) {
      ctx.redo!.stop(`run the Deploy workflow (migration 20261103100000) (${errorText(error).slice(0, 80)})`);
      return photos;
    }
  }
  return ctx.redo!.listing(type, wears, photos);
}
