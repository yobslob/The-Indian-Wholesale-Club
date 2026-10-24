import sharp from 'sharp';

import { jpegWidth } from '@repo/shared/domain';

import { readPhotoFile } from '@/lib/photo-store';

/** `<bucket>/<path>/s/<name>.w640.avif`: a stored photo's copy (packages/shared media.ts). */
const COPY_KEY = /^(product-media|review-media)\/[^?#]+\/s\/[^/]+\.w(640|1200)\.avif$/;
const YEAR = { 'cache-control': 'public, max-age=31536000, immutable', 'cdn-cache-control': 'max-age=31536000' };

/**
 * GET /media/jpeg/<copy key>?w=<width> (D-140): a stored photo's AVIF copy as a JPEG, for what can't show AVIF (email
 * clients, an old browser; `photoJpegUrl`). Made on the first request and then kept a year by the CDN and the browser
 * (photo paths are never reused), so it costs one conversion per photo and width. Only the widths in `JPEG_WIDTHS` are
 * made: any other is sent to the next one up (a cached redirect, no conversion), so no one can make the server convert
 * the same photo at a thousand widths. Anything else is a 404.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const key = (await params).key.map(decodeURIComponent).join('/');
  const url = new URL(request.url);
  const width = Number(url.searchParams.get('w') ?? 640);
  if (!COPY_KEY.test(key) || !Number.isInteger(width) || width < 1) return new Response(null, { status: 404 });
  const made = jpegWidth(width);
  // one address per photo and width (any other query, or none, is a new address to the CDN)
  if (url.search !== `?w=${made}`) {
    const to = new URL(url.pathname, url);
    to.searchParams.set('w', String(made));
    return new Response(null, { status: 308, headers: { location: to.pathname + to.search, ...YEAR } });
  }
  const avif = await readPhotoFile(key);
  if (!avif) return new Response(null, { status: 404 });
  const jpeg = await sharp(avif).resize({ width, withoutEnlargement: true }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpeg), { headers: { 'content-type': 'image/jpeg', ...YEAR } });
}
