import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://root.clothing';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/account/',
        '/checkout/',
        '/admin/',
        '/api/',
        '/order-status/',
        '/order-lookup/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
