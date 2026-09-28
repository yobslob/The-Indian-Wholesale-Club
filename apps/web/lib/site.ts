/** Brand (D-009). The logo is not designed yet (design.md). */
export const SITE_NAME = 'The Indian Wholesale Club';
export const SITE_SHORT_NAME = 'IWC';

/** Customer info pages (storefront.md). No admin link anywhere (D-006). */
export const INFO_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

/** Public URL of a product/region photo in the public `product-media` bucket. */
export function mediaUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const clean = storagePath.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
  return `${base}/storage/v1/object/public/product-media/${clean}`;
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
