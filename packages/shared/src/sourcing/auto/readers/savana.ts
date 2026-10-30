import { variantLabel } from '../../../domain/listing';
import { sourcedProductSchema, type SourcedProduct, type SourcedVariant } from '../../capture';
import { htmlToText, oneLine } from '../../text';
import { cleanOptions } from '../../variants';

import { httpsImage, isObj, makeOffer, pagedCollection, rupees, str, uniqueOffers, womensName, type Obj } from './util';

import type { Offer } from '../types';

/**
 * Savana (savana.com, D-171): its department pages ("activities", e.g. 12825 Shop All Dresses) list pieces from a JSON
 * answer the page itself asks for, 20 at a time, each answer leaving out the pieces already named in the request
 * (`visitedGoodsIdList`): the order is the shop's and stays the same while a run walks it. A target names an activity
 * and its pages ("collection:12825 pages:1-3"); the runner walks from the first page and keeps the walk for the next
 * target of the same activity (shops.ts). A product page carries its own data in `window.$preData`. Every piece read
 * on 2026-10-31 states "Country of Origin: PRC": listed as imported (founder: "It doesn't matter if they are made in
 * china"), never as made in India. Pages give fabric but no wash care, so its listings wait as drafts for their care.
 */

export const SAVANA_SITE = 'savana.com';
export const SAVANA_LIST_API = 'https://api-shop-in.savana.com/n/api/buyer/guide/user/goods-flow/pageList';
/** The product page's own data, as `window.$preData` holds it. */
export const SAVANA_DETAIL_KEY = '/n/api/intention/item/v4/detail';

/** "collection:12825 pages:4-6": the activity's id and the pages (of 20 pieces) the target reads. */
export function savanaCollection(query: string): { activity: string; from: number; to: number } | null {
  const c = pagedCollection(query);
  return c && /^\d{3,9}$/.test(c.handle) ? { activity: c.handle, from: c.from, to: c.to } : null;
}

/** The list answer's request body: one page of an activity, the pieces already seen left out. */
export const savanaListBody = (activity: string, page: number, seen: number[]) => ({
  flowId: activity,
  flowType: 'ACTIVITY',
  quickOptionId: null,
  screenParam: {},
  pgType: null,
  multiTopGoodsIdList: [],
  supportedFeatures: {},
  pageIndex: page,
  visitedGoodsIdList: seen,
  pageSize: 36,
});

/** "Ruffle Bodycon Dress", 2446392 → https://www.savana.com/details/ruffle-bodycon-dress-2446392 */
export function savanaProductUrl(name: string, id: number | string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `https://www.${SAVANA_SITE}/details/${slug || 'piece'}-${id}`;
}

const goodsOf = (json: unknown): Obj[] =>
  isObj(json) && isObj(json.data) && Array.isArray(json.data.goodsList) ? json.data.goodsList.filter(isObj) : [];

/** Whether the activity has pieces after this answer's. */
export const savanaHasNext = (json: unknown): boolean =>
  isObj(json) && isObj(json.data) && json.data.hasNextPage === true;

/** One list answer's pieces as offers (the selling price, the struck-through price as MRP). */
export function savanaListOffers(json: unknown): Offer[] {
  return uniqueOffers(
    goodsOf(json).map((g) => {
      const id = str(g.goodsId);
      const name = str(g.goodsName);
      if (!/^\d+$/.test(id) || !name) return null;
      const sale = rupees(g.promotePrice) ?? rupees(g.salePrice);
      const before = rupees(g.salePrice);
      const image = (Array.isArray(g.imageList) ? g.imageList : []).find(isObj);
      return makeOffer({
        site: SAVANA_SITE,
        url: savanaProductUrl(name, id),
        key: id,
        title: womensName(name),
        brand: 'Savana',
        pricePaise: sale,
        mrpPaise: before && sale && before > sale ? before : null,
        inStock: typeof g.supportPurchase === 'boolean' ? g.supportPurchase : null,
        image: httpsImage(image ? image.goodsThumb : null),
      });
    }),
  );
}

/** The ids an answer named, to leave out of the next request. */
export const savanaIds = (json: unknown): number[] =>
  goodsOf(json)
    .map((g) => Number(g.goodsId))
    .filter((n) => Number.isSafeInteger(n) && n > 0);

/** "[Color:Apricot,Size:M]" → { colour: "Apricot", size: "M" } */
function skuOptions(value: string): { colour: string; size: string } {
  const pairs = value.replace(/^\[|\]$/g, '').split(',');
  const get = (name: RegExp) =>
    oneLine(pairs.find((p) => name.test(p.split(':')[0] ?? ''))?.split(':').slice(1).join(':') ?? '');
  return { colour: get(/colou?r/i), size: get(/size/i) };
}

const SPEC_NAMES: Record<string, string> = { 'main fabric': 'Fabric', 'lining fabric': 'Lining' };

/** The page's "About this product" rows and its stated origin; never who imported or marketed it (D-003). */
function specsOf(d: Obj): [string, string][] {
  const about = isObj(d.aboutProduct) ? d.aboutProduct : {};
  const rows: [string, string][] = (Array.isArray(about.aboutProductDetail) ? about.aboutProductDetail : [])
    .filter(isObj)
    .map((r): [string, string] => {
      const key = oneLine(str(r.key));
      return [SPEC_NAMES[key.toLowerCase()] ?? key, oneLine(str(r.value))];
    })
    .filter(([k, v]) => k && v);
  const more = isObj(about.moreInfo) && Array.isArray(about.moreInfo.content) ? about.moreInfo.content : [];
  const origin = more
    .flat()
    .map(str)
    .map((line) => line.match(/^country of origin\s*:\s*(.+)$/i)?.[1] ?? '')
    .find(Boolean);
  // D-004: always a row, so a page that says nothing is never listed as made in India (listing.ts)
  rows.push(['Country of origin', oneLine(origin ?? '') || 'not stated']);
  return rows.map(([k, v]): [string, string] => [k.slice(0, 200), v.slice(0, 1000)]).slice(0, 40);
}

/** A product page's `$preData` detail as a product: one variant per colour and size, priced and stocked per size. */
export function savanaProduct(detail: unknown, pageUrl: string): SourcedProduct | null {
  if (!isObj(detail) || !str(detail.goodsName)) return null;
  const url = pageUrl.replace(/[?#].*$/, '');
  const variants: SourcedVariant[] = (Array.isArray(detail.skus) ? detail.skus : []).filter(isObj).flatMap((s) => {
    const key = str(s.saleSkuId);
    const { colour, size } = skuOptions(str(s.skuValue));
    if (!key || (!colour && !size)) return [];
    const options = cleanOptions({ colour, size });
    const price = rupees(s.promotePrice) ?? rupees(s.salesPrice);
    const before = rupees(s.salesPrice);
    return [
      {
        key: key.slice(0, 200),
        url,
        label: variantLabel(options).slice(0, 80),
        options,
        pricePaise: price,
        mrpPaise: before && price && before > price ? before : null,
        inStock: Number(s.isInStock) === 1 && Number(s.isOnSale) !== 0,
        weightG: null,
        image: null,
      },
    ];
  });
  const images = (Array.isArray(detail.images) ? detail.images : [])
    .filter(isObj)
    .map((i) => httpsImage(i.originalPic ?? i.picThumb))
    .filter((u): u is string => !!u);
  const cheapest = variants
    .filter((v) => v.inStock && v.pricePaise)
    .sort((a, b) => a.pricePaise! - b.pricePaise!)[0];
  const parsed = sourcedProductSchema.safeParse({
    url,
    site: SAVANA_SITE,
    title: womensName(oneLine(str(detail.goodsName))).slice(0, 300),
    brand: 'Savana',
    description: htmlToText(str(detail.goodsDescription)).slice(0, 8000),
    bullets: [],
    specs: specsOf(detail),
    images: [...new Set(images)].slice(0, 15),
    pricePaise: cheapest?.pricePaise ?? null,
    mrpPaise: cheapest?.mrpPaise ?? null,
    currency: 'INR',
    inStock: variants.length ? variants.some((v) => v.inStock) : null,
    sizes: [],
    hints: ['Women'],
    variants,
    deliveryText: null,
  });
  return parsed.success ? parsed.data : null;
}
