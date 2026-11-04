import 'server-only';

import type { IwcClient } from '@repo/db';

/** Signed URLs (an hour) for private files the admin looks at: shop bills (D-140). */
export async function signedUrls(
  client: IwcClient,
  bucket: 'vendor-docs',
  paths: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data } = await client.storage.from(bucket).createSignedUrls(unique, 3600);
  for (const row of data ?? []) if (row.path && row.signedUrl) map.set(row.path, row.signedUrl);
  return map;
}
