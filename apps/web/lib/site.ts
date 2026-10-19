/** Brand (D-009). The logo is not designed yet (design.md). */
export const SITE_NAME = 'The Indian Wholesale Club';
export const SITE_SHORT_NAME = 'IWC';

/** Customer info pages (storefront.md). No admin link anywhere (D-006). */
export const INFO_LINKS = [
  { href: '/about', label: 'About us' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

/**
 * Links to an info page are not prefetched (D-116): from a store page they open the @info glass panel (D-092), whose
 * routes render on request (see `app/(store)/@info/`), so a prefetch would be a server call per link on every page.
 */
export const isInfoPath = (href: string): boolean => INFO_LINKS.some((l) => l.href === href);

/**
 * A file in a public storage bucket at the site's own address (D-140): `/media/<bucket>/<path>`, which next.config.js
 * proxies to Supabase's storage and Vercel's CDN keeps for a year. Relative, like every link on the site; an email
 * puts the site's address in front.
 */
function publicUrl(bucket: string, storagePath: string): string {
  const clean = storagePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `/media/${bucket}/${clean}`;
}

/** Public URL of a product/region photo in the public `product-media` bucket. */
export function mediaUrl(storagePath: string): string {
  return publicUrl('product-media', storagePath);
}

/** Public URL of a review photo (`review-media`; only approved reviews' photos are ever linked, D-056). */
export function reviewPhotoUrl(storagePath: string): string {
  return publicUrl('review-media', storagePath);
}

/**
 * Only same-site relative paths are allowed as a post-login destination
 * (prevents open redirects such as //evil.example or https://…).
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return fallback;
  return value;
}
