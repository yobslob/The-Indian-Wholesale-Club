/**
 * Ordering several pieces from one shop at once (D-140, plan F3): one address that puts them all in the shop's cart,
 * where the shop has one. Amazon's add-to-cart link takes ASINs and quantities; a Shopify shop's /cart/ link takes
 * variant ids. Other shops (Myntra, Flipkart, the quick-commerce apps) have none: each piece opens in its own tab.
 */

export interface CartItem {
  itemUrl: string;
  quantity: number;
}

const asinOf = (u: URL): string | null =>
  u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)?.[1]?.toUpperCase() ?? null;

const shopifyVariantOf = (u: URL): string | null =>
  u.pathname.includes('/products/') ? (u.searchParams.get('variant')?.match(/^\d{6,20}$/)?.[0] ?? null) : null;

const qty = (n: number): number => Math.min(Math.max(Math.round(n), 1), 99);

/** The cart address for these items (all from one shop), or null when the shop cannot take them in one go. */
export function shopCartUrl(items: CartItem[]): string | null {
  if (items.length === 0) return null;
  let urls: URL[];
  try {
    urls = items.map((i) => new URL(i.itemUrl));
  } catch {
    return null;
  }
  const host = urls[0]!.hostname;
  if (urls.some((u) => u.hostname !== host || u.protocol !== 'https:')) return null;

  if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
    const asins = urls.map(asinOf);
    if (asins.some((a) => !a)) return null;
    const q = asins.map((a, i) => `ASIN.${i + 1}=${a}&Quantity.${i + 1}=${qty(items[i]!.quantity)}`).join('&');
    return `https://${host}/gp/aws/cart/add.html?${q}`;
  }
  const variants = urls.map(shopifyVariantOf);
  if (variants.every(Boolean)) {
    return `https://${host}/cart/${variants.map((v, i) => `${v}:${qty(items[i]!.quantity)}`).join(',')}`;
  }
  return null;
}
