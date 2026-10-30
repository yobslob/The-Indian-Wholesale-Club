import { variantLabel } from '../../../domain/listing';
import { sourcedProductSchema, type SourcedProduct, type SourcedVariant } from '../../capture';
import { htmlToText, oneLine } from '../../text';
import { cleanOptions } from '../../variants';

import { httpsImage, isObj, makeOffer, pagedCollection, rupees, str, uniqueOffers, womensName, type Obj } from './util';

import type { Offer } from '../types';

/**
 * NEWME (newme.asia, D-170, D-171): a Next.js shop whose pages carry their own data (__NEXT_DATA__), so nothing is read
 * off the screen. A target names one of its women's collections and the pages it reads ("collection:dresses
 * pages:1-4", 30 pieces a page, most sold first). Each piece states its country of origin: NEWME makes some in India
 * ("NM-IN-…" style codes) and imports others from China ("NM-PRC-…"); D-171 takes both, the China ones listed as
 * imported (listing.ts). Every size in stock counts: the founder's 10 days to the hub are NEWME's usual days.
 */

export const NEWME_SITE = 'newme.asia';

/** "collection:dresses pages:5-8" → { handle: "dresses", from: 5, to: 8 } (util.ts pagedCollection). */
export const newmeCollection = pagedCollection;

export const newmeCollectionUrl = (handle: string, page: number): string =>
  `https://${NEWME_SITE}/womens-collection/${encodeURIComponent(handle)}?p=${page}`;

export const newmeProductUrl = (slug: string): string =>
  `https://${NEWME_SITE}/product/${encodeURIComponent(slug)}`;

const sizesOf = (p: Obj): Obj[] => (Array.isArray(p.variations) ? p.variations.filter(isObj) : []);

/** D-171: a size NEWME has; the shop's 10 days apply to every size (founder: "It works under 10 days"). */
const inStock = (v: Obj): boolean => str(v.stock_status) === 'instock';

function piecesOn(nextData: unknown): Obj[] {
  const data =
    isObj(nextData) && isObj(nextData.props) && isObj(nextData.props.pageProps)
      ? nextData.props.pageProps.productsData
      : null;
  return isObj(data) && isObj(data.data) && Array.isArray(data.data.products)
    ? data.data.products.filter(isObj)
    : [];
}

/** How many pieces a collection page shows, made anywhere: none means the collection has no more pages. */
export const newmePieces = (nextData: unknown): number => piecesOn(nextData).length;

/** One collection page's pieces (its __NEXT_DATA__) as offers, made anywhere (D-171: the page decides the origin). */
export function newmeSearchOffers(nextData: unknown): Offer[] {
  return uniqueOffers(
    piecesOn(nextData).map((p) => {
      const slug = str(p.slug);
      if (!slug) return null;
      const sizes = sizesOf(p);
      const near = sizes.filter(inStock);
      const cheapest = (near.length ? near : sizes)
        .map((v) => ({ price: rupees(v.sale_price), mrp: rupees(v.regular_price) }))
        .filter((v) => v.price)
        .sort((a, b) => a.price! - b.price!)[0];
      return makeOffer({
        site: NEWME_SITE,
        url: newmeProductUrl(slug),
        key: str(p.product_id) || slug,
        title: womensName(str(p.name)),
        brand: 'NEWME',
        pricePaise: cheapest?.price ?? null,
        mrpPaise: cheapest?.mrp ?? null,
        inStock: sizes.length ? near.length > 0 : null,
        image: httpsImage(p.image_url),
      });
    }),
  );
}

/** The product page's piece: productData[0] of its __NEXT_DATA__. */
function pieceOf(nextData: unknown): Obj | null {
  const pp =
    isObj(nextData) && isObj(nextData.props) && isObj(nextData.props.pageProps)
      ? nextData.props.pageProps
      : null;
  const list = pp && Array.isArray(pp.productData) ? pp.productData : [];
  return list.find(isObj) ?? null;
}

const NOT_SAID = /^(n\/?a|na|none|-|)$/i;

/** The page's details worth keeping, as spec rows; "N/a" left out. Never who made or marketed it (D-003). */
function specsOf(p: Obj): [string, string][] {
  const info = isObj(p.product_info) ? p.product_info : {};
  const rows: [string, string][] = [
    ['Fabric', str(info.fabric)],
    ['Fabric type', str(info.fabric_type)],
    ['Wash care', str(info.washcare)],
    ['Fit', str(info.fit)],
    ['Style', str(info.style_type)],
    ['Print', str(info.print_type)],
    ['Lining', str(info.lining)],
    ['Occasion', str(info.occasion)],
    ['In the pack', str(info.package_include)],
    // D-004: always a row, so a page that says nothing is not listed as made in India (listing.ts); D-171: one that
    // says PRC is listed as imported
    ['Country of origin', str(p.country_of_origin) || 'not stated'],
  ];
  return rows
    .map(([k, v]): [string, string] => [k, oneLine(v).slice(0, 200)])
    .filter(([, v]) => !NOT_SAID.test(v));
}

/**
 * A product page's __NEXT_DATA__ as a product: one variant per size, priced and stocked per size. No delivery text:
 * the page's "by Tomorrow" or "12 – 14 days" is to the shop's pincode; the founder's 10 days to the hub apply (D-171).
 */
export function newmeProduct(nextData: unknown, pageUrl: string): SourcedProduct | null {
  const p = pieceOf(nextData);
  if (!p) return null;
  const url = pageUrl.replace(/[?#].*$/, '');
  const colour = isObj(p.product_info) ? str(p.product_info.color) : '';
  const sizes = sizesOf(p);
  const variants: SourcedVariant[] = sizes.flatMap((v) => {
    const key = str(v.id) || str(v.sku);
    const size = oneLine(str(v.size));
    if (!key || !size) return [];
    const options = cleanOptions({ colour, size });
    const price = rupees(v.sale_price);
    const mrp = rupees(v.regular_price);
    return [
      {
        key: key.slice(0, 200),
        url,
        label: variantLabel(options).slice(0, 80),
        options,
        pricePaise: price,
        mrpPaise: mrp && price && mrp >= price ? mrp : null,
        inStock: inStock(v),
        weightG: null,
        image: null,
      },
    ];
  });
  const gallery = (Array.isArray(p.gallery) ? p.gallery : [p.image_url])
    .map(httpsImage)
    .filter((u): u is string => !!u);
  const cheapest = variants
    .filter((v) => v.inStock && v.pricePaise)
    .sort((a, b) => a.pricePaise! - b.pricePaise!)[0];
  const parsed = sourcedProductSchema.safeParse({
    url,
    site: NEWME_SITE,
    title: womensName(oneLine(str(p.name))).slice(0, 300),
    brand: 'NEWME',
    description: htmlToText(str(p.product_description)).slice(0, 8000),
    bullets: [],
    specs: specsOf(p),
    images: [...new Set(gallery)].slice(0, 15),
    pricePaise: cheapest?.pricePaise ?? null,
    mrpPaise: cheapest?.mrpPaise ?? null,
    currency: 'INR',
    inStock: variants.length ? variants.some((v) => v.inStock) : null,
    sizes: [],
    hints: ['Women', str(p.category), str(p.subcategory)].filter(Boolean),
    variants,
    deliveryText: null,
  });
  return parsed.success ? parsed.data : null;
}
