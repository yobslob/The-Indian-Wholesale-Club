import { siteUrl } from '@/lib/env';

import type { MetadataRoute } from 'next';

/**
 * Admin is deliberately NOT listed here: naming it would advertise it (D-006).
 * Admin pages send noindex (header + meta) instead.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/checkout', '/cart', '/orders', '/api/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
