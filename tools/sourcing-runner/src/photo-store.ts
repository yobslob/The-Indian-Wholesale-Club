import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

import { COPY_WIDTHS, storeKeys } from '@repo/shared/domain';

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
    await Promise.all(
      COPY_WIDTHS.map(async (width, i) => {
        const body = await image.clone().resize({ width, withoutEnlargement: true }).avif(AVIF[width]).toBuffer();
        const url = `${this.base}/${keys[i]!.split('/').map(encodeURIComponent).join('/')}`;
        const res = await this.s3.fetch(url, {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'image/avif', 'cache-control': 'public, max-age=31536000, immutable' },
        });
        if (!res.ok) throw new Error(`photo store: ${res.status}`);
      }),
    );
  }
}
