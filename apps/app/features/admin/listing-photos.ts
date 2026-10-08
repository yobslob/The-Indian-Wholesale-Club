import * as ImagePicker from 'expo-image-picker';

import { addProductMedia } from '@repo/db/admin';
import { PHOTO_CACHE_CONTROL } from '@repo/shared/domain';

import { shrink, sniff } from '@/lib/photo-files';
import { supabase } from '@/lib/supabase';

/** A photo taken or picked for a listing, ready to upload. */
export interface ListingPhoto {
  uri: string;
  width: number;
  /** What the photo shows (alt text), required: screen readers read it (design.md §Accessibility). */
  alt: string;
}

/** Long enough edge for a sharp product page on any phone or laptop; small enough to upload from a shop. */
const MAX_EDGE = 2400;

/** Opens the camera (or the photo library) and returns the photos shrunk to at most 2400 px, as JPEG. */
export async function takePhotos(source: 'camera' | 'library'): Promise<ListingPhoto[] | 'denied'> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, allowsMultipleSelection: true, selectionLimit: 8 });
  if (result.canceled) return [];
  return Promise.all(result.assets.map(async (asset) => ({ ...(await shrink(asset, MAX_EDGE)), alt: '' })));
}

/**
 * Uploads a listing's photos with the admin's own session (storage policy "iwc admin insert") and records them
 * in product_media, in order, the first as the main photo. Returns the photos that failed, so they can be retried.
 */
export async function uploadListingPhotos(productId: string, photos: ListingPhoto[], startAt = 0): Promise<ListingPhoto[]> {
  const failed: ListingPhoto[] = [];
  for (const [i, photo] of photos.entries()) {
    try {
      const body = await (await fetch(photo.uri)).arrayBuffer();
      const { type, ext } = sniff(body);
      const path = `products/${productId}/${Date.now().toString(36)}-${i}.${ext}`;
      const { error } = await supabase.storage.from('product-media').upload(path, body, { contentType: type, cacheControl: PHOTO_CACHE_CONTROL });
      if (error) throw new Error(error.message);
      await addProductMedia(supabase, {
        product_id: productId,
        storage_path: path,
        alt_text: photo.alt.trim(),
        sort_order: startAt + i,
        is_primary: startAt + i === 0,
      });
    } catch {
      failed.push(photo);
    }
  }
  return failed;
}
