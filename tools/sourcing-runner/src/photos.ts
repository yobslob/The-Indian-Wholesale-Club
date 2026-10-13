import { errorText, log } from './log';

import type { RunContext } from './context';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Copies a new listing's photos into IWC's own storage (D-110, D-118): customers never load a shop's photo address
 * (D-003). Fetched with the browser's own request context (the shop's cookies, the page as referrer).
 */
export async function copyPhotos(
  ctx: RunContext,
  productId: string,
  photos: { url: string; itemKey: string | null; alt: string }[],
  referer: string,
): Promise<{ path: string; alt_text: string; item_key?: string }[]> {
  const out: { path: string; alt_text: string; item_key?: string }[] = [];
  for (const photo of photos.slice(0, 16)) {
    try {
      const res = await ctx.lanes.browser.request.get(photo.url, {
        timeout: 30_000,
        headers: { referer },
      });
      const type = res.headers()['content-type'] ?? '';
      if (!res.ok() || !/^image\/(jpeg|png|webp)/.test(type)) continue;
      const body = await res.body();
      if (body.length < 2_000 || body.length > MAX_BYTES) continue;
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
