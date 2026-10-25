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
      // D-160: search results are per visitor; a crawler following every word would run the database for nothing
      disallow: ['/account', '/checkout', '/cart', '/orders', '/api/', '/search', '/7-day-delivery/search'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
