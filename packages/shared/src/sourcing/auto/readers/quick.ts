import { countOf } from './marketplaces';
import { collect, httpsImage, isObj, makeOffer, num, str, uniqueOffers, type Obj } from './util';

import type { Offer } from '../types';

/**
 * Zepto and Instamart (D-118, D-152), read from the data their pages load: Zepto's search answer
 * (`/user-search-service/api/v3/search`, prices in paise) and its item page's Next.js flight data; Instamart's search
 * answer (`/api/instamart/search/v2`, prices in rupees) and its item page's state. Each result is one pack of a
 * product, so a product's packs share a group.
 */

export const zeptoItemUrl = (id: string): string => `https://www.zepto.com/pn/x/pvid/${id}`;
export const instamartItemUrl = (id: string): string =>
  `https://www.swiggy.com/instamart/item/${id}`;

const ZEPTO_IMAGES = 'https://cdn.zeptonow.com/production/';
const INSTAMART_IMAGES =
  'https://instamart-media-assets.swiggy.com/swiggy/image/upload/fl_lossy,f_auto,q_auto/';

const paise = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n > 0 ? Math.round(n) : null;
};

/** How many UTF-8 bytes of `text` from `from` make `bytes`: the characters a text row's byte length covers. */
function charsFor(text: string, from: number, bytes: number): number {
  let i = from;
  for (let left = bytes; left > 0 && i < text.length;) {
    const c = text.codePointAt(i)!;
    left -= c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    i += c >= 0x10000 ? 2 : 1;
  }
  return i - from;
}

/**
 * A Next.js page's flight data (`self.__next_f`'s strings, joined): each `id:JSON` row parsed. A text row
 * (`id:T<hex bytes>,…`) has no line end, so the next row starts right after its text; other rows are skipped.
 */
export function flightRows(text: string): unknown[] {
  const rows: unknown[] = [];
  const head = /([0-9a-f]*):(T([0-9a-f]+),)?/y;
  for (let at = 0; at < text.length;) {
    head.lastIndex = at;
    const m = head.exec(text);
    if (m?.[2]) {
      at = head.lastIndex + charsFor(text, head.lastIndex, parseInt(m[3]!, 16));
      continue;
    }
    const start = m ? head.lastIndex : at;
    const end = text.indexOf('\n', start) < 0 ? text.length : text.indexOf('\n', start);
    if (m && (text[start] === '[' || text[start] === '{')) {
      try {
        rows.push(JSON.parse(text.slice(start, end)));
      } catch {
        // not a whole row: not product data
      }
    }
    at = end + 1;
  }
  return rows;
}

// ---------------------------------------------------------------- Zepto

/**
 * Every product in Zepto's data: an object with the `product` and its pack (`productVariant`), priced on itself
 * (search's `productResponse`) or in its `storeProduct` (the item page). `eta` is the page's "6 mins".
 */
export function zeptoOffers(data: unknown, eta: string | null): Offer[] {
  const items = collect(data, (o) => isObj(o.product) && isObj(o.productVariant));
  return uniqueOffers(
    items.map((o) => {
      const product = o.product as Obj;
      const variant = o.productVariant as Obj;
      const store = isObj(o.storeProduct) ? o.storeProduct : o;
      const id = str(variant.id);
      if (!id) return null;
      const pack = str(variant.formattedPacksize);
      const images = Array.isArray(variant.images) ? variant.images.filter(isObj) : [];
      const rating = isObj(variant.ratingSummary) ? variant.ratingSummary : {};
      const qty = num(store.availableQuantity);
      const tags = isObj(store.meta) && Array.isArray(store.meta.tags) ? store.meta.tags : [];
      return makeOffer({
        site: 'zepto.com',
        url: zeptoItemUrl(id),
        key: id,
        title: `${str(product.name)} ${pack}`.trim(),
        brand: str(product.brand) || null,
        pricePaise: paise(store.discountedSellingPrice ?? store.sellingPrice),
        mrpPaise: paise(store.mrp),
        inStock:
          store.outOfStock === true ? false : qty !== null ? qty > 0 : store.outOfStock === false,
        deliveryText: eta,
        pack: pack || null,
        rating: num(rating.averageRating),
        ratingCount: num(rating.totalRatings),
        sponsored: tags.some((t) => isObj(t) && t.type === 'SPONSORED'),
        image: images[0] ? httpsImage(ZEPTO_IMAGES + str(images[0].path)) : null,
        group: str(product.id) || null,
      });
    }),
  );
}

// ---------------------------------------------------------------- Instamart

/** `{ units: "146", nanos: 0 }` (rupees) in paise. */
const money = (v: unknown): number | null =>
  isObj(v) ? paise((num(v.units) ?? 0) * 100 + (num(v.nanos) ?? 0) / 1e7) : null;

/**
 * Every item in Instamart's data (search's cards, the item page's `productV2.itemData`): one offer per pack
 * (`variations`). The pack the card shows (`listingVariant`) is keyed by the item's id, as its page's address is;
 * the other packs by their own id, in the item's group.
 */
export function instamartOffers(data: unknown, eta: string | null): Offer[] {
  const items = collect(
    data,
    (o) => Array.isArray(o.variations) && typeof o.displayName === 'string' && !!str(o.productId),
  );
  return uniqueOffers(
    items.flatMap((item) => {
      const id = str(item.productId);
      const packs = (item.variations as unknown[]).filter(isObj);
      const shown = packs.find((v) => v.listingVariant === true) ?? packs[0];
      return packs.map((v) => {
        const price = isObj(v.price) ? v.price : {};
        const inventory = isObj(v.inventory) ? v.inventory : {};
        const rating = isObj(v.rating) ? v.rating : {};
        const images = Array.isArray(v.imageIds) ? v.imageIds : [];
        const pack = str(v.quantityDescription);
        const stock = inventory.inStock ?? item.inStock;
        return makeOffer({
          site: 'swiggy.com',
          url: instamartItemUrl(id),
          key: v === shown ? id : str(v.spinId) || `${id}-${pack}`,
          title: `${str(v.displayName) || str(item.displayName)} ${pack}`.trim(),
          brand: str(v.brandName) || str(item.brand) || null,
          pricePaise: money(price.offerPrice) ?? money(price.mrp),
          mrpPaise: money(price.mrp),
          inStock: typeof stock === 'boolean' ? stock : null,
          deliveryText: eta,
          pack: pack || null,
          rating: num(rating.value),
          ratingCount: countOf(str(rating.count)),
          image: str(images[0]) ? httpsImage(INSTAMART_IMAGES + str(images[0])) : null,
          group: id,
        });
      });
    }),
  );
}
