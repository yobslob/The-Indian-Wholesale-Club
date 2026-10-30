import { unwrap, type IwcClient } from '../client';

/** Home's photos (D-169): the founder's own, in the order Home's mosaic shows them. */
export async function listHomePhotos(client: IwcClient) {
  return unwrap(
    await client
      .from('home_photos')
      .select('id, storage_path, alt_text, sort_order, created_at')
      .order('sort_order')
      .order('created_at'),
  );
}

/** Adds a photo after the last one. */
export async function addHomePhoto(client: IwcClient, storagePath: string, altText: string) {
  const last = unwrap(await client.from('home_photos').select('sort_order').order('sort_order', { ascending: false }).limit(1));
  unwrap(await client.from('home_photos').insert({ storage_path: storagePath, alt_text: altText, sort_order: (last[0]?.sort_order ?? 0) + 1 }));
}

/** The new order in one call: every photo's id, first tile first. */
export async function orderHomePhotos(client: IwcClient, ids: string[]) {
  unwrap(await client.rpc('admin_order_home_photos', { p_ids: ids }));
}

/** Changes a photo's line (alt text). */
export async function updateHomePhotoAlt(client: IwcClient, photoId: string, altText: string) {
  unwrap(await client.from('home_photos').update({ alt_text: altText }).eq('id', photoId));
}

/** Removes a photo and returns its storage path (the caller deletes the file). */
export async function removeHomePhoto(client: IwcClient, photoId: string): Promise<string | null> {
  const rows = unwrap(await client.from('home_photos').delete().eq('id', photoId).select('storage_path'));
  return rows[0]?.storage_path ?? null;
}
