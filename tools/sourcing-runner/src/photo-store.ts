import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

import { COPY_WIDTHS, PRINT_BLUR, PRINT_SIZE, storeKeys, type PhotoPrint } from '@repo/shared/domain';

import type { Env } from './env';

/**
 * The photo store (D-140, packages/shared media.ts): the runner writes a new listing's photos there itself, as two AVIF
 * copies (the same settings as apps/web/lib/photo-copies.ts), so neither Supabase's storage (1 GB on its free plan) nor
 * the website's CPU carries them. Needs IWC_PHOTO_STORE_* in tools/sourcing-runner/.env (README.md); without them the
 * runner uploads to Supabase's storage as before and the admin panel moves the photos later.
 */
const AVIF = { 640: { quality: 60, effort: 2 }, 1200: { quality: 55, effort: 2 } } as const;

export class PhotoStore {
  private constructor(
    private readonly s3: AwsClient,
    private readonly base: string,
  ) {}

  static from(env: Env): PhotoStore | null {
    if (!env.IWC_PHOTO_STORE_S3_URL || !env.IWC_PHOTO_STORE_KEY_ID || !env.IWC_PHOTO_STORE_SECRET) return null;
    const s3 = new AwsClient({
      accessKeyId: env.IWC_PHOTO_STORE_KEY_ID,
      secretAccessKey: env.IWC_PHOTO_STORE_SECRET,
      service: 's3',
      region: env.IWC_PHOTO_STORE_REGION,
    });
    return new PhotoStore(s3, env.IWC_PHOTO_STORE_S3_URL.replace(/\/+$/, ''));
  }

  /** Writes a photo's copies for the recorded path `path` (an s/ path) in `product-media`. */
  async put(path: string, bytes: Uint8Array): Promise<void> {
    const image = sharp(bytes, { failOn: 'error' }).rotate();
    const keys = storeKeys('product-media', path);
    const written = await Promise.allSettled(
      COPY_WIDTHS.map(async (width, i) => {
        const body = await image.clone().resize({ width, withoutEnlargement: true }).avif(AVIF[width]).toBuffer();
        const res = await this.s3.fetch(this.url(keys[i]!), {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'image/avif', 'cache-control': 'public, max-age=31536000, immutable' },
        });
        if (!res.ok) throw new Error(`photo store: ${res.status}`);
      }),
    );
    const failed = written.find((r) => r.status === 'rejected');
    if (failed) {
      // one copy without the other is never shown (the photo goes to Supabase instead): it goes too
      await this.remove(path).catch(() => undefined);
      throw failed.reason;
    }
  }

  /** Deletes a photo's copies (a key that isn't there is fine). */
  async remove(path: string): Promise<void> {
    await Promise.all(
      storeKeys('product-media', path).map(async (key) => {
        const res = await this.s3.fetch(this.url(key), { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error(`photo store: ${res.status} deleting ${key}`);
      }),
    );
  }

  private url(key: string): string {
    return `${this.base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}

/** A photo's print, to spot the same picture saved twice (D-142; as apps/web/lib/photo-copies.ts); null if unreadable. */
export async function photoPrint(bytes: Uint8Array): Promise<PhotoPrint | null> {
  try {
    const image = sharp(bytes, { failOn: 'error' });
    const { width, height, orientation } = await image.metadata();
    if (!width || !height) return null;
    const turned = (orientation ?? 1) >= 5;
    const pixels = await image
      .rotate()
      .flatten({ background: '#fff' })
      .resize(PRINT_SIZE, PRINT_SIZE, { fit: 'fill' })
      .blur(PRINT_BLUR)
      .removeAlpha()
      .raw()
      .toBuffer();
    return { width: turned ? height : width, height: turned ? width : height, pixels: new Uint8Array(pixels) };
  } catch {
    return null;
  }
}
