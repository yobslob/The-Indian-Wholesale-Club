import 'server-only';

import { mediaUrl } from '@/lib/site';

import type { IwcClient } from '@repo/db';

/**
 * Photo URLs for vendor screens: the vendor's own photos are private (vendor-uploads; a signed URL for an hour, made
 * with the vendor's own session, so the storage rule still decides), store photos are public (product-media).
 */
export async function photoUrls(
  client: IwcClient,
  items: { bucket: 'vendor-uploads' | 'product-media'; path: string | null }[],
): Promise<(string | null)[]> {
  const privatePaths = [...new Set(items.filter((i) => i.bucket === 'vendor-uploads' && i.path).map((i) => i.path as string))];
  const signed = new Map<string, string>();
  if (privatePaths.length > 0) {
    const { data } = await client.storage.from('vendor-uploads').createSignedUrls(privatePaths, 3600);
    for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, row.signedUrl);
  }
  return items.map((i) => (!i.path ? null : i.bucket === 'product-media' ? mediaUrl(i.path) : (signed.get(i.path) ?? null)));
}
