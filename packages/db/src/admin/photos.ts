import { unwrap, type IwcClient } from '../client';

/** A stored photo without its fixed copies yet (D-140): where its path is recorded, and the path. */
export interface PhotoWithoutCopies {
  table: 'product_media' | 'region_photos' | 'regions';
  id: string;
  path: string;
}

const NOT_COPIED = '%/c/%';

/**
 * Photos still without copies, oldest first: listing photos, album photos and regions' main photos (a photo uploaded
 * from the phone or by the auto-sourcing runner without them, or one from before D-140). At most `limit` of each.
 */
export async function listPhotosWithoutCopies(client: IwcClient, limit: number): Promise<PhotoWithoutCopies[]> {
  const [media, album, regions] = await Promise.all([
    client.from('product_media').select('id, storage_path').not('storage_path', 'like', NOT_COPIED).order('created_at').limit(limit),
    client.from('region_photos').select('id, storage_path').not('storage_path', 'like', NOT_COPIED).order('created_at').limit(limit),
    client
      .from('regions')
      .select('id, hero_image_path')
      .not('hero_image_path', 'is', null)
      .not('hero_image_path', 'like', NOT_COPIED)
      .limit(limit),
  ]);
  return [
    ...unwrap(media).map((r) => ({ table: 'product_media' as const, id: r.id, path: r.storage_path })),
    ...unwrap(album).map((r) => ({ table: 'region_photos' as const, id: r.id, path: r.storage_path })),
    ...unwrap(regions).map((r) => ({ table: 'regions' as const, id: r.id, path: r.hero_image_path! })),
  ];
}

/** Points a photo's row at its copies' path (only while it still names the old one, so a newer change wins). */
export async function setPhotoPath(client: IwcClient, photo: PhotoWithoutCopies, path: string): Promise<void> {
  if (photo.table === 'regions') {
    unwrap(await client.from('regions').update({ hero_image_path: path }).eq('id', photo.id).eq('hero_image_path', photo.path));
  } else {
    unwrap(await client.from(photo.table).update({ storage_path: path }).eq('id', photo.id).eq('storage_path', photo.path));
  }
}

/** One listing's photos still without copies (just uploaded from the phone). */
export async function listProductPhotosWithoutCopies(client: IwcClient, productId: string): Promise<PhotoWithoutCopies[]> {
  const rows = unwrap(
    await client.from('product_media').select('id, storage_path').eq('product_id', productId).not('storage_path', 'like', NOT_COPIED),
  );
  return rows.map((r) => ({ table: 'product_media' as const, id: r.id, path: r.storage_path }));
}
