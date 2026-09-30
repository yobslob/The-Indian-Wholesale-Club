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
    ];
  },
};

module.exports = nextConfig;
