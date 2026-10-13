import { variantLabel } from '../../../domain/listing';
import { cleanOptions, packGrams } from '../../variants';

import {
  collect,
  httpsImage,
  isObj,
  makeOffer,
  num,
  rupees,
  str,
  uniqueOffers,
  type Obj,
} from './util';

import type { SourcedVariant } from '../../capture';
import type { Offer } from '../types';

/**
 * Quick-commerce shops (D-118): Blinkit (its page state), BigBasket (its listing API and page data), and Zepto and
 * Instamart read generically: any product-like object in the page's data, its price unit checked against what the
 * page shows. They deliver to the hub's address set in the runner's browser, in minutes.
 */

// ---------------------------------------------------------------- Blinkit (window.__reduxStore__ state)

const blinkitUrl = (id: string) => `https://blinkit.com/prn/x/prid/${id}`;

/** Search results: the cart items in the page state. `eta` is the page's "15 MINS". */
export function blinkitOffers(state: unknown, eta: string | null): Offer[] {
  const items = collect(
    state,
    (o) => 'product_id' in o && 'product_name' in o && 'price' in o && 'unit' in o,
  );
  return uniqueOffers(
    items.map((o) => {
      const id = str(o.product_id);
      return makeOffer({
        site: 'blinkit.com',
        url: blinkitUrl(id),
        key: id,
        title: `${str(o.product_name)} ${str(o.unit)}`.trim(),
        brand: str(o.brand) || null,
        pricePaise: rupees(o.price),
        mrpPaise: rupees(o.mrp),
        inStock: num(o.inventory) === null ? null : num(o.inventory)! > 0,
        deliveryText: eta,
        pack: str(o.unit) || null,
        image: httpsImage(o.image_url),
        group: str(o.group_id) || null,
      });
    }),
  );
}

/** An item page: the item's price and stock (the page state has it once with an inventory). */
export function blinkitItem(
  state: unknown,
  id: string,
): { pricePaise: number | null; mrpPaise: number | null; inStock: boolean | null } | null {
  const hits = collect(state, (o) => str(o.product_id) === id && 'price' in o);
  const best = hits.find((o) => 'inventory' in o) ?? hits[0];
  if (!best) return null;
  const inv = num(best.inventory);
  return {
    pricePaise: rupees(best.price),
    mrpPaise: rupees(best.mrp),
    inStock: inv === null ? (best.is_sold_out === true ? false : null) : inv > 0,
  };
}

// ---------------------------------------------------------------- BigBasket (/listing-svc/v2/products, __NEXT_DATA__)

function bigbasketItem(p: Obj, group: string | null): Offer | null {
  const id = str(p.id);
  const pricing = isObj(p.pricing) && isObj(p.pricing.discount) ? p.pricing.discount : {};
  const prim = isObj(pricing.prim_price) ? pricing.prim_price : {};
  const avail = isObj(p.availability) ? p.availability : {};
  const brand = isObj(p.brand) ? str(p.brand.name) : '';
  const images = Array.isArray(p.images) ? p.images.filter(isObj) : [];
  const rating = isObj(p.rating_info) ? p.rating_info : {};
  const path = str(p.absolute_url);
  if (!id || !path.startsWith('/')) return null;
  return makeOffer({
    site: 'bigbasket.com',
    url: `https://www.bigbasket.com${path}`,
    key: id,
    title: `${brand} ${str(p.desc)} ${str(p.w)}`.trim(),
    brand: brand || null,
    pricePaise: rupees(prim.sp),
    mrpPaise: rupees(pricing.mrp),
    // "001" sells; "010" is "we are currently not delivering this" to the hub's address
    inStock: str(avail.avail_status)
      ? str(avail.avail_status) === '001' && avail.not_for_sale !== true
      : null,
    pack: str(p.w) || null,
    rating: num(rating.avg_rating),
    ratingCount: num(rating.rating_count),
    image: httpsImage(images[0]?.l ?? images[0]?.m),
    group,
  });
}

export function bigbasketOffers(json: unknown): Offer[] {
  const products = collect(json, (o) => 'absolute_url' in o && 'pricing' in o && 'desc' in o);
  return uniqueOffers(
    products.flatMap((p) => {
      const children = Array.isArray(p.children) ? p.children.filter(isObj) : [];
      const group = children.length ? str(p.id) : null;
      return [bigbasketItem(p, group), ...children.map((c) => bigbasketItem(c, group))];
    }),
  );
}

/** A product page's pack sizes (__NEXT_DATA__.props.pageProps.productDetails.children), one family. */
export function bigbasketFamily(nextData: unknown): Offer[] {
  const props = isObj(nextData) && isObj(nextData.props) ? nextData.props.pageProps : null;
  const details = isObj(props) && isObj(props.productDetails) ? props.productDetails : null;
  const children = details && Array.isArray(details.children) ? details.children.filter(isObj) : [];
  return uniqueOffers(children.map((c) => bigbasketItem(c, 'page')));
}

// ---------------------------------------------------------------- a family page's items as variants

/** The pack sizes of a family (BigBasket's children, Blinkit's group) as variants. */
export function packVariants(offers: Offer[]): SourcedVariant[] {
  return offers.map((o) => {
    const options = cleanOptions({ pack: o.pack ?? '' });
    return {
      key: o.key,
      url: o.url,
      label: variantLabel(options).slice(0, 80),
      options,
      pricePaise: o.pricePaise,
      mrpPaise: o.mrpPaise,
      inStock: o.inStock,
      weightG: packGrams(o.pack ?? ''),
      image: o.image,
    };
  });
}

// ---------------------------------------------------------------- Zepto, Instamart: any product-like object

const NAME = ['product_name', 'productName', 'display_name', 'displayName', 'name', 'title'];
const PRICE = [
  'selling_price',
  'sellingPrice',
  'discountedSellingPrice',
  'offer_price',
  'offerPrice',
  'sp',
  'price',
];
const MRP = ['mrp', 'MRP', 'marked_price', 'markedPrice', 'store_price'];
const ID = [
  'product_variant_id',
  'productVariantId',
  'variant_id',
  'variantId',
  'product_id',
  'productId',
  'item_id',
  'id',
];
const PACK = [
  'unit',
  'pack_size',
  'packSize',
  'quantity',
  'weight',
  'formattedPacksize',
  'sku_quantity_with_combo',
];
const first = (o: Obj, keys: string[]): unknown =>
  keys.map((k) => o[k]).find((v) => v !== undefined && v !== null && v !== '');

/**
 * Products in a page's data by shape: a name, a price and an id. Prices are rupees or paise depending on the shop;
 * the page's own text decides (a price shown as "₹107" means rupees; only "₹1.07"-sized amounts mean paise).
 */
export function genericOffers(
  blobs: unknown[],
  pageText: string,
  site: string,
  urlFor: (id: string, name: string) => string,
  eta: string | null,
): Offer[] {
  const shown = new Set(
    [...pageText.matchAll(/₹\s?([\d,]+(?:\.\d{1,2})?)/g)].map((m) =>
      Number(m[1]!.replace(/,/g, '')),
    ),
  );
  const objects = blobs.flatMap((b) =>
    collect(
      b,
      (o) =>
        typeof first(o, NAME) === 'string' &&
        num(first(o, PRICE)) !== null &&
        first(o, ID) !== undefined,
    ),
  );
  const unit = (() => {
    let rupeeHits = 0;
    let paiseHits = 0;
    for (const o of objects.slice(0, 200)) {
      const p = num(first(o, PRICE))!;
      if (shown.has(p)) rupeeHits++;
      if (shown.has(p / 100)) paiseHits++;
    }
    return paiseHits > rupeeHits ? 100 : 1;
  })();
  return uniqueOffers(
    objects.map((o) => {
      const id = str(first(o, ID));
      const name = str(first(o, NAME));
      const stockFlag = o.outOfStock ?? o.out_of_stock ?? o.is_sold_out ?? o.isSoldOut;
      const qty = num(o.inventory ?? o.availableQuantity ?? o.available_quantity);
      const pack = str(first(o, PACK));
      const brand = isObj(o.brand) ? str(o.brand.name) : str(o.brand ?? o.brandName);
      return makeOffer({
        site,
        url: urlFor(id, name),
        key: id,
        title: `${name} ${pack}`.trim(),
        brand: brand || null,
        pricePaise: rupees(num(first(o, PRICE))! / unit),
        mrpPaise: rupees((num(first(o, MRP)) ?? 0) / unit),
        inStock:
          typeof stockFlag === 'boolean'
            ? !stockFlag
            : qty !== null
              ? qty > 0
              : o.available === false
                ? false
                : null,
        deliveryText: eta,
        pack: pack || null,
        image: httpsImage(first(o, ['image_url', 'imageUrl', 'image', 'img'])),
        group: str(o.group_id ?? o.groupId ?? o.product_id ?? '') || null,
      });
    }),
  );
}
