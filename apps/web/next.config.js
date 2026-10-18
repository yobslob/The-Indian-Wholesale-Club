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
    staticGenerationMaxConcurrency: 2,
    staticGenerationRetryCount: 3,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // Photos are never overwritten (every upload gets a new random path), so a resized copy stays right: keep it a
    // month instead of re-encoding it every hour (the storage default, max-age=3600). Same quality (75, the default).
    minimumCacheTTL: 2678400,
    remotePatterns: [
      supabaseUrl
        ? {
            protocol: /** @type {'http' | 'https'} */ (supabaseUrl.protocol.replace(':', '')),
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: '/storage/v1/object/public/**',
          }
        : {
            protocol: 'https',
            hostname: '*.supabase.co',
            pathname: '/storage/v1/object/public/**',
          },
    ],
  },
  // The See all pages and their filters are served from one cached route (app/(store)/see-all), like the state pages,
  // instead of rendering on every request; the address in the browser stays /clothing?state=kerala (D-011, PR-1).
  async rewrites() {
    return { beforeFiles: seeAllRewrites() };
  },
  // D-110: Spices became Food; old links keep working.
  async redirects() {
    return [{ source: '/spices', destination: '/food', permanent: true }];
  },
  async headers() {
    return [
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
