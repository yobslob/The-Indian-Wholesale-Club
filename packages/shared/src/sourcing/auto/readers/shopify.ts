import { sourcedProductSchema, type SourcedProduct } from '../../capture';
import { htmlToText, oneLine, parseRupeesToPaise } from '../../text';
import { shopifyVariants } from '../../variants';

import { httpsImage, isObj, makeOffer, str, uniqueOffers } from './util';

import type { Offer } from '../types';

/**
 * Shopify shops (Oyela, Offduty, …; D-118) publish their catalogue as JSON, so no browser is needed: search with
 * /search/suggest.json, read a product with /products/<handle>.js (prices in paise there).
 */

export const shopifySearchUrl = (site: string, query: string): string =>
  `https://${site}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=10`;

export const shopifyProductJsUrl = (pageUrl: string): string | null => {
  try {
    const u = new URL(pageUrl);
    const handle = u.pathname.match(/\/products\/([^/?#]+)/)?.[1];
    return handle ? `${u.origin}/products/${handle}.js` : null;
  } catch {
    return null;
  }
};

export function shopifySearchOffers(json: unknown, site: string): Offer[] {
  const products =
    isObj(json) &&
    isObj(json.resources) &&
    isObj(json.resources.results) &&
    Array.isArray(json.resources.results.products)
      ? json.resources.results.products.filter(isObj)
      : [];
  return uniqueOffers(
    products.map((p) => {
      const handle = str(p.handle);
      if (!handle) return null;
      return makeOffer({
        site,
        url: `https://${site}/products/${handle}`,
        key: handle,
        title: str(p.title),
        brand: str(p.vendor) || null,
        pricePaise: parseRupeesToPaise(str(p.price)),
        mrpPaise: parseRupeesToPaise(str(p.compare_at_price_max) || str(p.compare_at_price)),
        inStock: typeof p.available === 'boolean' ? p.available : null,
        image: httpsImage(isObj(p.featured_image) ? p.featured_image.url : p.image),
      });
    }),
  );
}

/** /products/<handle>.js as a product with its variants (colour, size…) and photos. */
export function shopifyProduct(
  json: unknown,
  pageUrl: string,
  site: string,
): SourcedProduct | null {
  if (!isObj(json)) return null;
  const variants = shopifyVariants(json, pageUrl);
  const images = (Array.isArray(json.images) ? json.images : [])
    .map((i) => httpsImage(isObj(i) ? i.src : i))
    .filter((u): u is string => !!u);
  const cheapest = variants
    .filter((v) => v.inStock !== false && v.pricePaise)
    .sort((a, b) => a.pricePaise! - b.pricePaise!)[0];
  const parsed = sourcedProductSchema.safeParse({
    url: pageUrl.replace(/[?#].*$/, ''),
    site,
    title: oneLine(str(json.title)).slice(0, 300),
    brand: str(json.vendor).slice(0, 120) || null,
    description: htmlToText(str(json.description)).slice(0, 8000),
    bullets: [],
    specs: [],
    images: images.slice(0, 15),
    pricePaise: cheapest?.pricePaise ?? null,
    mrpPaise: cheapest?.mrpPaise ?? null,
    currency: 'INR',
    inStock: typeof json.available === 'boolean' ? json.available : null,
    sizes: [],
    hints: [str(json.type)].filter(Boolean),
    variants,
    deliveryText: null,
  });
  return parsed.success ? parsed.data : null;
}
