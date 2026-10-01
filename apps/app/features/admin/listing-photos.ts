import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { addProductMedia } from '@repo/db/admin';

import { supabase } from '@/lib/supabase';

/** A photo taken or picked for a listing, ready to upload. */
export interface ListingPhoto {
  uri: string;
  width: number;
  /** What the photo shows (alt text), required: screen readers read it (design.md §Accessibility). */
  alt: string;
}

/**
 * What a file really is, from its first bytes. The manipulator is asked for JPEG, but its web version (the app's
 * preview) hands back PNG; labelling by content means a file is never stored under the wrong type.
 */
function sniff(bytes: ArrayBuffer): { type: string; ext: string } {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50) return { type: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return { type: 'image/webp', ext: 'webp' };
  return { type: 'image/jpeg', ext: 'jpg' };
}

/** Long enough edge for a sharp product page on any phone or laptop; small enough to upload from a shop. */
const MAX_EDGE = 2400;

async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<ListingPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > MAX_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, alt: '' };
}

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
  return Promise.all(result.assets.map(shrink));
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
      const { error } = await supabase.storage.from('product-media').upload(path, body, { contentType: type });
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
