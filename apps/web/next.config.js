/**
 * Supabase origin (hosted *.supabase.co or local http://127.0.0.1:54321) for
 * images, auth, Realtime and the Content-Security-Policy.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
// A NEXT_PUBLIC_ value ships to every browser: stop the build on anything but the plain project address, so a pasted
// database connection string (with its password) never reaches the page (found 2026-10-12).
if (
  supabaseUrl &&
  (!['http:', 'https:'].includes(supabaseUrl.protocol) || supabaseUrl.username || supabaseUrl.password || supabaseUrl.pathname !== '/')
) {
  throw new Error(
    'NEXT_PUBLIC_SUPABASE_URL must be the project address only, like https://<project-ref>.supabase.co ' +
      '(Supabase → Project Settings → Data API → Project URL), not the database connection string.',
  );
}
const supabaseOrigin = supabaseUrl ? supabaseUrl.origin : 'https://*.supabase.co';

/** The photo store's public address (lib/photo-store.ts), e.g. https://pub-<id>.r2.dev; null when not set up. */
const photoStorePublic = process.env.PHOTO_STORE_PUBLIC_URL ? process.env.PHOTO_STORE_PUBLIC_URL.replace(/\/+$/, '') : null;
// Read when the site is built (turbo.json passes it to the build): without it /media/s/ has no route and every stored
// photo is a 404 (production, 2026-10-21), so a production build stops instead.
if (process.env.VERCEL_ENV === 'production' && !photoStorePublic) {
  throw new Error('PHOTO_STORE_PUBLIC_URL is not set for this build (docs/ops.md §Photos; turbo.json build env)');
}

/**
 * D-140, the photo fix: photos come from the site's own address, so a page never names a storage host and needs no
 * second connection. `/media/s/<bucket>/<path>` is a stored photo's AVIF copy in the photo store (Cloudflare R2; no
 * charge for its traffic); `/media/<bucket>/<path>` a photo still in Supabase's storage (only the two public photo
 * buckets). Every photo path is new and never overwritten (PR-6), so the CDN may keep them a year (headers below).
 * `/media/jpeg/...` is a route (app/media/jpeg), not a rewrite.
 */
function mediaRewrites() {
  return [
    ...(photoStorePublic ? [{ source: '/media/s/:path*', destination: `${photoStorePublic}/:path*` }] : []),
    ...(supabaseUrl
      ? [
          {
            source: '/media/:bucket(product-media|review-media)/:path*',
            destination: `${supabaseUrl.origin}/storage/v1/object/public/:bucket/:path*`,
          },
        ]
      : []),
  ];
}

/**
 * /clothing, /food and /home-and-gifts with any of ?state=, ?category=, ?show=, ?for= →
 * /see-all/<type>/<state>/<category>/<show>/<for> ("all" and 24 when absent; ?for= is women or men, D-140). The rules with the most filters come first; a filter that is not a plain slug or number
 * is left out, as the page always did (browseParams).
 */
function seeAllRewrites() {
  const filters = { state: '[a-z0-9-]{1,80}', category: '[a-z0-9-]{1,80}', show: '[0-9]{1,4}', for: 'women|men' };
  const keys = Object.keys(filters);
  const sets = [];
  for (let mask = 0; mask < 1 << keys.length; mask += 1) sets.push(keys.filter((_, i) => mask & (1 << i)));
  return sets
    .sort((a, b) => b.length - a.length)
    .map((used) => ({
      source: '/:type(clothing|food|home-and-gifts)',
      ...(used.length
        ? { has: used.map((k) => ({ type: 'query', key: k, value: `(?<${k}>${filters[k]})` })) }
        : {}),
      destination: `/see-all/:type/${keys.map((k) => (used.includes(k) ? `:${k}` : k === 'show' ? '24' : 'all')).join('/')}`,
    }));
}
/**
 * D-154: the 7-day store's See all pages, /7-day-delivery/food and /7-day-delivery/home-and-gifts with ?category= →
 * /7-day-delivery/<type>/<category> ("all" when absent). Its other filters are read in the browser.
 */
function quickRewrites() {
  const source = '/7-day-delivery/:type(food|home-and-gifts)';
  return [
    { source, has: [{ type: 'query', key: 'category', value: '(?<category>[a-z0-9-]{1,80})' }], destination: '/7-day-delivery/:type/:category' },
    { source, destination: '/7-day-delivery/:type/all' },
  ];
}
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
// React Fast Refresh needs eval in development only.
const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

const SECURITY_HEADERS = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/db', '@repo/shared'],
  // Lint and typecheck run once, before the build (check.mjs, CI); `next build` repeating
  // them cost time on every build (engineering.md P7). Never deploy without CI passing.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Admin photo uploads (region photos, up to 8 MB) go through server actions; the default limit is 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
    // The build prerenders every state and See all page from the production database (PR-1). Fewer at once per worker
    // and a retry keep a busy moment of the database (statement timeout, 2026-10-18) from failing the whole deploy.
    staticGenerationMaxConcurrency: 1,
    staticGenerationRetryCount: 3,
  },
  // D-140: Vercel's image resizer is off. Its allowance (5,000 photos a month) ran out and photos answered 402
  // (2026-10-18). Every photo is served as fixed copies made when it is stored (lib/photo-copies.ts), straight from
  // Supabase's CDN; anything still drawn with next/image is served as it is, so the allowance can never run out again.
  images: { unoptimized: true },
  // The See all pages and their filters are served from one cached route (app/(store)/see-all), like the state pages,
  // instead of rendering on every request; the address in the browser stays /clothing?state=kerala (D-011, PR-1).
  async rewrites() {
    return { beforeFiles: [...mediaRewrites(), ...seeAllRewrites(), ...quickRewrites()] };
  },
  // D-110: Spices became Food; old links keep working.
  async redirects() {
    return [{ source: '/spices', destination: '/food', permanent: true }];
  },
  async headers() {
    return [
      {
        // D-140: photos from the site's own address, kept by Vercel's CDN for a year (mediaRewrites). Supabase's answers
        // set a cookie, which Vercel never caches (checked 2026-10-20); R2's public address sets none.
        source: '/media/:path*',
        headers: [
          { key: 'x-vercel-enable-rewrite-caching', value: '1' },
          { key: 'CDN-Cache-Control', value: 'max-age=31536000' },
        ],
      },
      {
        // Every page but the importer, whose preview shows the source site's photos before they are copied (D-110).
        source: '/((?!admin/import).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${devEval} https://js.stripe.com`,
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              `img-src 'self' data: blob: ${supabaseOrigin}`,
              `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://api.stripe.com`,
            ].join('; '),
          },
          ...SECURITY_HEADERS,
        ],
      },
      {
        source: '/admin/import',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${devEval}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self' data:",
              `img-src 'self' data: blob: https: ${supabaseOrigin}`,
              `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
            ].join('; '),
          },
          ...SECURITY_HEADERS,
        ],
      },
      {
        // The emails' logo and fonts (D-094) load inside email apps, from another origin; they never change between
        // deploys of the same name, so a day of caching is safe.
        source: '/email/:file*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
