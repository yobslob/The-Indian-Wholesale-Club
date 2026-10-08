/**
 * Supabase origin (hosted *.supabase.co or local http://127.0.0.1:54321) for
 * images, auth, Realtime and the Content-Security-Policy.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;
const supabaseOrigin = supabaseUrl ? supabaseUrl.origin : 'https://*.supabase.co';
const supabaseWs = supabaseOrigin.replace(/^http/, 'ws');
// React Fast Refresh needs eval in development only.
const devEval = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/db', '@repo/shared'],
  // Lint and typecheck run once, before the build (check.mjs, CI); `next build` repeating
  // them cost time on every build (engineering.md P7). Never deploy without CI passing.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  // Admin photo uploads (region photos, up to 8 MB) go through server actions; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
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
  async headers() {
    return [
      {
        source: '/(.*)',
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
