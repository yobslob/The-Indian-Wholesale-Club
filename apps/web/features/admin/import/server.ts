import 'server-only';

import { addProductMedia } from '@repo/db/admin';
import { PHOTO_CACHE_CONTROL } from '@repo/shared/domain';
import {
  captureFromHtml,
  isPublicHttpsUrl,
  looksBlocked,
  normalizeCapture,
  type SourcedProduct,
} from '@repo/shared/sourcing';

import type { IwcClient } from '@repo/db';

/** A desktop browser's headers: many shops answer a bare server request with an empty page. */
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-IN,en;q=0.9',
};
const MAX_PAGE_BYTES = 6 * 1024 * 1024;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** The body as bytes, refusing more than `max` (a page or photo that never ends). */
async function readCapped(response: Response, max: number): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}

/**
 * "Paste links" (D-110): the server reads a shop's product page itself. Works for shops that put their product data
 * in the page; Myntra, Amazon and Flipkart usually refuse servers, and the answer says to use the Add to IWC button.
 */
export async function readSourcePage(
  url: string,
): Promise<{ product: SourcedProduct } | { error: string }> {
  if (!isPublicHttpsUrl(url)) return { error: 'Use the full https:// address of a product page.' };
  let response: Response;
  try {
    response = await fetch(url, {
      headers: HEADERS,
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { error: 'The shop did not answer. Open the page and use the Add to IWC button.' };
  }
  if (!isPublicHttpsUrl(response.url || url))
    return { error: 'The page moved somewhere we do not read.' };
  if (!response.ok)
    return {
      error: `The shop refused the server (${response.status}). Open the page and use the Add to IWC button.`,
    };
  const bytes = await readCapped(response, MAX_PAGE_BYTES);
  if (!bytes) return { error: 'The page is too large to read.' };
  const html = new TextDecoder().decode(bytes);
  const product = normalizeCapture(captureFromHtml(html, response.url || url));
  if (product) return { product };
  return {
    error: looksBlocked(html)
      ? 'The shop showed the server a robot check. Open the page and use the Add to IWC button.'
      : 'No product found on that page. Open it and use the Add to IWC button.',
  };
}

/**
 * Copies the chosen photos into our own storage (product-media/products/<product>/), so the store never loads a
 * shop's address (D-003) and a photo stays when the shop removes it. One that fails is skipped and counted.
 */
export async function copySourcePhotos(
  client: IwcClient,
  productId: string,
  urls: string[],
  altBase: string,
  firstOrder = 0,
): Promise<{ copied: number; failed: number }> {
  const results = await Promise.all(
    urls.map(async (url, i) => {
      if (!isPublicHttpsUrl(url)) return null;
      try {
        const response = await fetch(url, {
          headers: { 'user-agent': HEADERS['user-agent'], accept: 'image/avif,image/webp,image/*' },
          cache: 'no-store',
          signal: AbortSignal.timeout(20_000),
        });
        const type = (response.headers.get('content-type') ?? '')
          .split(';')[0]!
          .trim()
          .toLowerCase();
        const ext = PHOTO_TYPES[type];
        if (!response.ok || !ext || !isPublicHttpsUrl(response.url || url)) return null;
        const bytes = await readCapped(response, MAX_PHOTO_BYTES);
        if (!bytes || bytes.byteLength < 2_000) return null;
        const path = `products/${productId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await client.storage
          .from('product-media')
          .upload(path, bytes, { contentType: type, cacheControl: PHOTO_CACHE_CONTROL });
        return error ? null : { path, order: i };
      } catch {
        return null;
      }
    }),
  );
  const saved = results.filter((r): r is { path: string; order: number } => r !== null);
  for (const [n, photo] of saved.entries()) {
    await addProductMedia(client, {
      product_id: productId,
      storage_path: photo.path,
      alt_text: `${altBase}, photo ${n + 1}`,
      sort_order: firstOrder + n,
      is_primary: firstOrder === 0 && n === 0,
    });
  }
  return { copied: saved.length, failed: urls.length - saved.length };
}
