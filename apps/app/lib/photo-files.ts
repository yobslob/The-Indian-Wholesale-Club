import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type * as ImagePicker from 'expo-image-picker';

/**
 * What a file really is, from its first bytes. The manipulator is asked for JPEG, but its web version (the app's
 * preview) hands back PNG; labelling by content means a file is never stored under the wrong type.
 */
export function sniff(bytes: ArrayBuffer): { type: string; ext: string } {
  const b = new Uint8Array(bytes.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50) return { type: 'image/png', ext: 'png' };
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return { type: 'image/webp', ext: 'webp' };
  return { type: 'image/jpeg', ext: 'jpg' };
}

/** A picked photo shrunk to `maxEdge` on its longest side, as JPEG: its local address and width. */
export async function shrink(asset: ImagePicker.ImagePickerAsset, maxEdge: number): Promise<{ uri: string; width: number }> {
  const context = ImageManipulator.manipulate(asset.uri);
  const longest = Math.max(asset.width, asset.height);
  if (longest > maxEdge) {
    context.resize(asset.width >= asset.height ? { width: maxEdge } : { height: maxEdge });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width };
}
