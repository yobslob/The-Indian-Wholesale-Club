import { parseRupeesToPaise } from '../../text';

import { httpsImage, isObj, makeOffer, num, str, uniqueOffers } from './util';

import type { Offer } from '../types';

/**
 * Search results of Amazon India, Flipkart and Myntra (D-118). The runner reads the page's own data in the browser
 * (runner pages.ts) and hands it here.
 */

/** "(1,234)", "1.2K", "12k ratings" as a number. */
export function countOf(text: string): number | null {
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (!m) return null;
  const n =
    Number(m[1]) *
    (m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' ? 1_000_000 : 1);
  return Math.round(n);
}

/** One Amazon result as the page shows it (div[data-component-type="s-search-result"]). */
export interface AmazonRow {
  asin: string;
  title: string;
  price: string;
  mrp: string;
  delivery: string;
  rating: string;
  count: string;
  sponsored: boolean;
  image: string;
}

export function amazonSearchOffers(rows: AmazonRow[], site = 'amazon.in'): Offer[] {
  return uniqueOffers(
    rows.map((r) =>
      /^[A-Z0-9]{10}$/.test(r.asin)
        ? makeOffer({
            site,
            url: `https://www.${site}/dp/${r.asin}`,
            key: r.asin,
            title: r.title,
            pricePaise: parseRupeesToPaise(r.price),
            mrpPaise: parseRupeesToPaise(r.mrp),
            // Amazon lists only what it can sell; "Currently unavailable" rows have no price
            inStock: r.price ? true : null,
            deliveryText: r.delivery || null,
            rating: num(
              r.rating.match(/(\d(?:\.\d)?)\s*out of/)?.[1] ?? r.rating.match(/^\d(\.\d)?$/)?.[0],
            ),
            ratingCount: countOf(r.count),
            sponsored: r.sponsored,
            image: httpsImage(r.image),
          })
        : null,
    ),
  );
}

/** One Flipkart result card: its pid (data-id), text, link and photo. */
export interface FlipkartCard {
  id: string;
  text: string;
  href: string;
  image: string;
}

/**
 * The price and MRP of a card's text. Flipkart prints the MRP and the discount with no space ("₹301₹39824% off"),
 * so the MRP is the reading of those digits that agrees with the discount.
 */
export function flipkartPrices(text: string): (number | null)[] {
  const out: (number | null)[] = [];
  for (const m of text.matchAll(/₹\s?([\d,]+)(\s*%\s*off)?/gi)) {
    const digits = m[1]!.replace(/,/g, '');
    if (!m[2] || out.length === 0 || out[0] === null) {
      out.push(parseRupeesToPaise(digits));
      continue;
    }
    const price = out[0] / 100;
    const split = [1, 2]
      .map((k) => ({ mrp: Number(digits.slice(0, -k)), pct: Number(digits.slice(-k)) }))
      .find(({ mrp, pct }) => mrp > price && Math.abs(((mrp - price) / mrp) * 100 - pct) < 1.5);
    out.push(split ? parseRupeesToPaise(split.mrp) : null);
  }
  return out;
}

export function flipkartSearchOffers(cards: FlipkartCard[]): Offer[] {
  return uniqueOffers(
    cards.map((c) => {
      const lines = c.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const isRating = (l: string) => /^\d(\.\d)?\s*\(?[\d,]+\)?$/.test(l) || /^\d(\.\d)?$/.test(l);
      const isPrice = (l: string) => l.startsWith('₹');
      const firstInfo = lines.findIndex(
        (l) => isRating(l) || isPrice(l) || /% off|sold out/i.test(l),
      );
      const head = lines.slice(0, firstInfo < 0 ? 1 : Math.max(firstInfo, 1));
      const rating = lines.find(isRating)?.match(/^(\d(?:\.\d)?)\s*\(?([\d,]+)?\)?$/);
      const prices = flipkartPrices(c.text);
      let url: URL;
      try {
        url = new URL(c.href, 'https://www.flipkart.com');
      } catch {
        return null;
      }
      const pid = url.searchParams.get('pid') ?? c.id;
      return makeOffer({
        site: 'flipkart.com',
        url: `https://www.flipkart.com${url.pathname}?pid=${pid}`,
        key: pid,
        title: head.join(' '),
        brand: head.length > 1 ? head[0]! : null,
        pricePaise: prices[0] ?? null,
        mrpPaise: prices[1] ?? null,
        inStock: /sold out|currently unavailable|out of stock|coming soon/i.test(c.text)
          ? false
          : prices.length
            ? true
            : null,
        rating: num(rating?.[1]),
        ratingCount: num(rating?.[2]),
        image: httpsImage(c.image),
      });
    }),
  );
}

/** Myntra's search data (window.__myx.searchData.results.products). Its prices are rupees. */
export function myntraSearchOffers(products: unknown): Offer[] {
  if (!Array.isArray(products)) return [];
  return uniqueOffers(
    products.filter(isObj).map((p) => {
      const id = str(p.productId);
      const path = str(p.landingPageUrl).replace(/^\/+/, '');
      if (!id || !path) return null;
      const inventory = Array.isArray(p.inventoryInfo) ? p.inventoryInfo.filter(isObj) : [];
      return makeOffer({
        site: 'myntra.com',
        url: `https://www.myntra.com/${path}`,
        key: id,
        title: str(p.productName) || `${str(p.brand)} ${str(p.additionalInfo)}`.trim(),
        brand: str(p.brand) || null,
        pricePaise: parseRupeesToPaise(num(p.price)),
        mrpPaise: parseRupeesToPaise(num(p.mrp)),
        inStock: inventory.length ? inventory.some((i) => i.available === true) : null,
        deliveryText:
          str(isObj(p.deliveryPromise) ? p.deliveryPromise.text : p.deliveryPromise) || null,
        rating: num(p.rating) || null,
        ratingCount: num(p.ratingCount),
        image: httpsImage(p.searchImage),
        siblings: (Array.isArray(p.colourVariants) ? p.colourVariants.filter(isObj) : [])
          .map((v) => str(v.styleId))
          .filter((sid) => /^\d+$/.test(sid) && sid !== id)
          .slice(0, 12)
          .map((sid) => `https://www.myntra.com/${sid}`),
      });
    }),
  );
}

/** A target's price band in paise (D-121), for the shop's own price filter. */
export interface PriceBand {
  minPaise: number | null;
  maxPaise: number | null;
}

/**
 * D-137: how many result pages one search reads. A few listings need one page; a target that wants 40 reads four, so
 * the results left after the price, match, stock and delivery checks are enough for them.
 */
export const searchPages = (want: number): number => Math.min(4, Math.max(1, Math.ceil(want / 10)));

/** Amazon India's search, narrowed by its own price filter (`rh=p_36:<min>-<max>`, in paise) and paged. */
export function amazonSearchUrl(query: string, band: PriceBand, page = 1): string {
  const p = new URLSearchParams({ k: query });
  if (band.minPaise || band.maxPaise)
    p.set('rh', `p_36:${band.minPaise ?? ''}-${band.maxPaise ?? ''}`);
  if (page > 1) p.set('page', String(page));
  return `https://www.amazon.in/s?${p}`;
}

/** Flipkart's search, narrowed by its own price filter (in rupees; "Max" when the band has no top) and paged. */
export function flipkartSearchUrl(query: string, band: PriceBand, page = 1): string {
  const p = new URLSearchParams({ q: query });
  if (band.minPaise || band.maxPaise) {
    p.append('p[]', `facets.price_range.from=${Math.floor((band.minPaise ?? 0) / 100)}`);
    p.append(
      'p[]',
      `facets.price_range.to=${band.maxPaise ? Math.ceil(band.maxPaise / 100) : 'Max'}`,
    );
  }
  if (page > 1) p.set('page', String(page));
  return `https://www.flipkart.com/search?${p}`;
}
