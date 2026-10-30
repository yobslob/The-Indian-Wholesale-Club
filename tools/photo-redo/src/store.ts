import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';

import { storeKeys } from '@repo/shared/domain';

import type { Env } from './env';

/**
 * The photo store (Cloudflare R2, D-140) through its S3 API with the founder's token: the redo reads a photo's 1200
 * copy (a read; R2 charges no egress), writes a new photo's two AVIF copies (two writes) and deletes a replaced
 * photo's copies (deletes are free). Listing is for the audit only (a write per 1,000 keys).
 */

/** The copies' settings: the runner's and the website's (photo-store.ts, photo-copies.ts), with more encoder effort:
 * the laptop has the time, and smaller files keep R2 under its 10 GB. */
const AVIF = { 640: { quality: 60, effort: 6 }, 1200: { quality: 55, effort: 6 } } as const;
const WIDTHS = [640, 1200] as const;

export interface Listed {
  key: string;
  size: number;
  modified: Date;
}

export class Store {
  private readonly s3: AwsClient;
  private readonly base: string;

  constructor(env: Env) {
    this.s3 = new AwsClient({
      accessKeyId: env.IWC_PHOTO_STORE_KEY_ID,
      secretAccessKey: env.IWC_PHOTO_STORE_SECRET,
      service: 's3',
      region: env.IWC_PHOTO_STORE_REGION,
    });
    this.base = env.IWC_PHOTO_STORE_S3_URL.replace(/\/+$/, '');
  }

  private url(key: string): string {
    return `${this.base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.s3.fetch(this.url(key));
    if (!res.ok) throw new Error(`photo store: ${res.status} for ${key}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const res = await this.s3.fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`photo store: ${res.status} deleting ${key}`);
  }

  /** Writes a photo's two copies for the recorded path `path` (`products/<id>/s/<name>.jpg`) in product-media. */
  async putCopies(path: string, image: Buffer): Promise<void> {
    const keys = storeKeys('product-media', path);
    const written = await Promise.allSettled(
      WIDTHS.map(async (width, i) => {
        const body = await sharp(image)
          .resize({ width, withoutEnlargement: true })
          .avif(AVIF[width])
          .toBuffer();
        const res = await this.s3.fetch(this.url(keys[i]!), {
          method: 'PUT',
          body: new Uint8Array(body),
          headers: { 'content-type': 'image/avif', 'cache-control': 'public, max-age=31536000, immutable' },
        });
        if (!res.ok) throw new Error(`photo store: ${res.status} writing ${keys[i]}`);
      }),
    );
    const failed = written.find((r) => r.status === 'rejected');
    if (failed) {
      // one copy without the other is never shown: it goes too
      await Promise.allSettled(keys.map((k) => this.delete(k)));
      throw failed.reason;
    }
  }

  /** Every key under `prefix`, 1,000 per request. */
  async *list(prefix: string): AsyncGenerator<Listed[]> {
    let token: string | null = null;
    do {
      const q = new URLSearchParams({ 'list-type': '2', prefix, 'max-keys': '1000' });
      if (token) q.set('continuation-token', token);
      const res = await this.s3.fetch(`${this.base}?${q}`);
      if (!res.ok) throw new Error(`photo store: ${res.status} listing ${prefix}`);
      const xml = await res.text();
      const tag = (block: string, name: string): string =>
        new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block)?.[1] ?? '';
      yield [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((m) => ({
        key: tag(m[1]!, 'Key').replace(/&amp;/g, '&'),
        size: Number(tag(m[1]!, 'Size')),
        modified: new Date(tag(m[1]!, 'LastModified')),
      }));
      token = tag(xml, 'IsTruncated') === 'true' ? tag(xml, 'NextContinuationToken') || null : null;
    } while (token);
  }
}
