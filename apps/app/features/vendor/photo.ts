import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'jpeg-js';

import { checkPhoto, type PhotoChecks } from '@repo/shared/vendor';

import { shrink } from '@/lib/photo-files';
import { supabase } from '@/lib/supabase';

const MAX_EDGE = 2400;
const OVERVIEW = 256;
const CROP = 512;

/** Grey pixels of a JPEG given as base64 (the manipulator's output). */
function greyFromBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const img = decode(bytes, { useTArray: true, formatAsRGBA: true });
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * (img.data[i * 4] ?? 0) + 0.587 * (img.data[i * 4 + 1] ?? 0) + 0.114 * (img.data[i * 4 + 2] ?? 0);
  }
  return out;
}

export type TakenPhoto = { uri: string; checks: PhotoChecks };

/**
 * Opens the camera (or the gallery), then checks the photo at once as the website does (@repo/shared/vendor: size,
 * light, blur on a full-resolution centre crop) and shrinks it to 2400 px for sending.
 */
export async function takeVendorPhoto(source: 'camera' | 'library'): Promise<TakenPhoto | 'denied' | null> {
  const permission =
    source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'denied';
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const overviewCtx = ImageManipulator.manipulate(asset.uri);
  overviewCtx.resize(asset.width >= asset.height ? { width: OVERVIEW } : { height: OVERVIEW });
  const overview = await (await overviewCtx.renderAsync()).saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.9 });

  const side = Math.min(CROP, asset.width, asset.height);
  const cropCtx = ImageManipulator.manipulate(asset.uri);
  cropCtx.crop({ originX: Math.floor((asset.width - side) / 2), originY: Math.floor((asset.height - side) / 2), width: side, height: side });
  const crop = await (await cropCtx.renderAsync()).saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.95 });

  const checks = checkPhoto({
    width: asset.width,
    height: asset.height,
    overview: greyFromBase64(overview.base64 ?? ''),
    crop: greyFromBase64(crop.base64 ?? ''),
    cropSide: side,
  });
  const shrunk = await shrink(asset, MAX_EDGE);
  return { uri: shrunk.uri, checks };
}

/** Sends a photo into the vendor's own folder (storage rule: vendor_may_upload). */
export async function sendVendorPhoto(uri: string, path: string): Promise<void> {
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('vendor-uploads').upload(path, body, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(error.message);
}
