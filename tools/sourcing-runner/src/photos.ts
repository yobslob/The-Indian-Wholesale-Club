import { pictureGroups, sharpest } from '@repo/shared/domain';

import { errorText, log } from './log';
import { photoPrint } from './photo-store';

import type { RunContext } from './context';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copies a new listing's photos into IWC's own storage (D-110, D-118): customers never load a shop's photo address
 * (D-003). Fetched with the browser's own request context (the shop's cookies, the page as referrer). A photo the
 * shop shows twice (a full-size photo and its preview, D-142) is kept once, at full size, in its first place.
 */
export async function copyPhotos(
  ctx: RunContext,
  productId: string,
  photos: { url: string; itemKey: string | null; alt: string }[],
  referer: string,
): Promise<{ path: string; alt_text: string; item_key?: string }[]> {
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
  const out: { path: string; alt_text: string; item_key?: string }[] = [];
  for (const group of groups) {
    const { photo } = got[group[0]!]!;
    const { body, type } = got[sharpest(group, prints)]!;
    try {
      const path = await ctx.db!.upload(productId, body, type);
      out.push({
        path,
        alt_text: photo.alt.slice(0, 200),
        ...(photo.itemKey ? { item_key: photo.itemKey } : {}),
      });
    } catch (error) {
      log(`  photo not copied: ${errorText(error)}`);
    }
  }
  return out;
}
