import { siteUrl } from '@/lib/env';

import type { MetadataRoute } from 'next';

// D-160: search results are per visitor; a crawler following every word would run the database for nothing.
const NEVER_CRAWLED = ['/account', '/checkout', '/cart', '/orders', '/api/', '/search'];

// D-189: every filter combination is a page of its own in Vercel's page cache, and a crawler walks them all. The address
// without a filter, the state pages and the product pages are in the sitemap and stay open.
const FILTER_ADDRESSES = ['/clothing?', '/food?', '/home-and-gifts?', '/see-all/', '/states/*?'];

// D-189: crawlers that gather pages for AI training or SEO tools, each a walk of 14,000 listings that brings no customers.
// Search engines and the AI assistants' own search crawlers are not on this list.
const NO_CUSTOMERS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'DataForSeoBot',
  'PetalBot',
];

/**
 * Admin is deliberately NOT listed here: naming it would advertise it (D-006).
 * Admin pages send noindex (header + meta) instead.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: NO_CUSTOMERS, disallow: '/' },
      { userAgent: '*', allow: '/', disallow: [...NEVER_CRAWLED, ...FILTER_ADDRESSES] },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
