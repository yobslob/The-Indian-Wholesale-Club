import { unwrap, type IwcClient } from '../client';

/** A photo still in Supabase's storage, not yet in the photo store (D-140): where its path is recorded, and the path. */
export interface PhotoWithoutCopies {
  table: 'product_media' | 'region_photos' | 'home_photos' | 'regions';
  id: string;
  path: string;
}

/** A stored photo's path sits in an `s/` folder (packages/shared media.ts). */
const STORED = '%/s/%';

/**
 * Listing and album photos added in the last `days` and still in Supabase's storage (from the phone or the
 * auto-sourcing runner without a photo store), oldest first, at most `limit`. Older photos are moved by
 * `pnpm photos:copies` from a computer, not by the website.
 */
export async function listPhotosWithoutCopies(client: IwcClient, limit: number, days = 3): Promise<PhotoWithoutCopies[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [media, album, home] = await Promise.all([
    client.from('product_media').select('id, storage_path').not('storage_path', 'like', STORED).gte('created_at', since).order('created_at').limit(limit),
    client.from('region_photos').select('id, storage_path').not('storage_path', 'like', STORED).gte('created_at', since).order('created_at').limit(limit),
    client.from('home_photos').select('id, storage_path').not('storage_path', 'like', STORED).gte('created_at', since).order('created_at').limit(limit),
  ]);
  return [
    ...unwrap(media).map((r) => ({ table: 'product_media' as const, id: r.id, path: r.storage_path })),
    ...unwrap(album).map((r) => ({ table: 'region_photos' as const, id: r.id, path: r.storage_path })),
    ...unwrap(home).map((r) => ({ table: 'home_photos' as const, id: r.id, path: r.storage_path })),
  ].slice(0, limit);
}

/** Points a photo's row at its copies' path (only while it still names the old one, so a newer change wins). */
export async function setPhotoPath(client: IwcClient, photo: PhotoWithoutCopies, path: string): Promise<void> {
  if (photo.table === 'regions') {
    unwrap(await client.from('regions').update({ hero_image_path: path }).eq('id', photo.id).eq('hero_image_path', photo.path));
  } else {
    unwrap(await client.from(photo.table).update({ storage_path: path }).eq('id', photo.id).eq('storage_path', photo.path));
  }
}

/** One listing's photos still in Supabase's storage (just uploaded from the phone). */
export async function listProductPhotosWithoutCopies(client: IwcClient, productId: string): Promise<PhotoWithoutCopies[]> {
  const rows = unwrap(
    await client.from('product_media').select('id, storage_path').eq('product_id', productId).not('storage_path', 'like', STORED),
  );
  return rows.map((r) => ({ table: 'product_media' as const, id: r.id, path: r.storage_path }));
}
