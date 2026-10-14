import {
  captureScript,
  normalizeCapture,
  parseDeliveryDays,
  rawCaptureSchema,
  type SourcedProduct,
} from '@repo/shared/sourcing';
import {
  amazonSearchOffers,
  bigbasketFamily,
  bigbasketOffers,
  blinkitItem,
  blinkitOffers,
  flipkartSearchOffers,
  genericOffers,
  itemKeyOf,
  myntraSearchOffers,
  packVariants,
  shopifyProduct,
  shopifyProductJsUrl,
  shopifySearchOffers,
  shopifySearchUrl,
  type Offer,
  type ShopReader,
} from '@repo/shared/sourcing/auto';

import { open, type Lane } from './browser';
import * as read from './pages';

import type { Page } from 'playwright';

/**
 * Each shop's way in (D-118): how to search it and how to read a product page into the shared shapes. Amazon,
 * Flipkart and Myntra are read like the "Add to IWC" button reads them (the same capture); the quick-commerce shops
 * from their page data; Shopify shops from their catalogue JSON.
 */

export interface PageRead {
  product: SourcedProduct | null;
  /** The page's own delivery promise in days (null: it shows none; the shop's usual days then apply). */
  pageDays: number | null;
}

/** What a search may narrow by, where the shop's own filter supports it (D-121); results are checked again anyway. */
export interface SearchHint {
  minPaise: number | null;
  maxPaise: number | null;
  /** How many listings the target wants: a shop with pages reads a second one for a big number. */
  want: number;
}

interface Shop {
  search(lane: Lane, query: string, hint?: SearchHint): Promise<Offer[]>;
  read(lane: Lane, url: string, now: Date): Promise<PageRead>;
}

const q = encodeURIComponent;

async function captured(page: Page, url: string, waitFor?: string): Promise<SourcedProduct | null> {
  await open(page, url, waitFor);
  const raw = rawCaptureSchema.safeParse(await page.evaluate(captureScript));
  return raw.success ? normalizeCapture(raw.data) : null;
}

/** Amazon, Flipkart, Myntra and any other shop with product data in its pages. */
const capturedRead =
  (waitFor?: string): Shop['read'] =>
  (lane, url, now) =>
    lane.run(async (page) => {
      const product = await captured(page, url, waitFor);
      return { product, pageDays: parseDeliveryDays(product?.deliveryText, now) };
    });

/** A quick-commerce page's product, priced from the shop's own data for that item (and its pack sizes). */
function groceryRead(
  url: string,
  offers: Offer[],
  eta: string | null,
  now: Date,
  product: SourcedProduct | null,
): PageRead {
  const key = itemKeyOf(url);
  const own = offers.find((o) => o.key === key);
  if (!product || !own) return { product: null, pageDays: null };
  const family = offers.filter(
    (o) => o === own || (own.group && o.group === own.group && o.site === own.site),
  );
  return {
    product: {
      ...product,
      pricePaise: own.pricePaise,
      mrpPaise: own.mrpPaise,
      inStock: own.inStock,
      variants: family.length > 1 ? packVariants(family) : [],
    },
    pageDays: parseDeliveryDays(eta, now),
  };
}

const SHOPS: Record<ShopReader, Shop> = {
  amazon: {
    search: (lane, query) =>
      lane.run(async (page) => {
        await open(
          page,
          `https://www.amazon.in/s?k=${q(query)}`,
          'div[data-component-type="s-search-result"]',
        );
        return amazonSearchOffers(await read.amazonRows(page));
      }),
    read: capturedRead('#productTitle'),
  },
  flipkart: {
    search: (lane, query) =>
      lane.run(async (page) => {
        await open(page, `https://www.flipkart.com/search?q=${q(query)}`, 'div[data-id]');
        return flipkartSearchOffers(await read.flipkartCards(page));
      }),
    read: capturedRead(),
  },
  myntra: {
    search: (lane, query, hint) =>
      lane.run(async (page) => {
        const slug = query
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        // Myntra's own price filter (D-121): "Price:600.0_1600.0_600.0 TO 1600.0"
        const lo = hint?.minPaise ? hint.minPaise / 100 : null;
        const hi = hint?.maxPaise ? hint.maxPaise / 100 : null;
        const rf =
          lo !== null || hi !== null
            ? `&rf=${q(`Price:${(lo ?? 0).toFixed(1)}_${(hi ?? 100000).toFixed(1)}_${(lo ?? 0).toFixed(1)} TO ${(hi ?? 100000).toFixed(1)}`)}`
            : '';
        const base = `https://www.myntra.com/${slug}?rawQuery=${q(query)}${rf}`;
        await open(page, base);
        const offers = myntraSearchOffers(await read.myntraProducts(page));
        if ((hint?.want ?? 0) <= 12 || offers.length < 40) return offers;
        await open(page, `${base}&p=2`);
        return [...offers, ...myntraSearchOffers(await read.myntraProducts(page))];
      }),
    read: capturedRead(),
  },
  shopify: {
    search: async (lane, query) =>
      shopifySearchOffers(await lane.json(shopifySearchUrl(lane.site, query)), lane.site),
    read: async (lane, url) => {
      const js = shopifyProductJsUrl(url);
      return {
        product: js ? shopifyProduct(await lane.json(js), url, lane.site) : null,
        pageDays: null,
      };
    },
  },
  blinkit: {
    search: (lane, query) =>
      lane.run(async (page) => {
        await open(page, `https://blinkit.com/s/?q=${q(query)}`);
        return blinkitOffers(await read.blinkitState(page, 'search'), await read.etaText(page));
      }),
    read: (lane, url, now) =>
      lane.run(async (page) => {
        const product = await captured(page, url);
        const state = await read.blinkitState(page, 'pdp');
        const id = itemKeyOf(url);
        const item = blinkitItem(state, id);
        if (!product || !item) return { product: null, pageDays: null };
        const photos = [
          ...new Set(
            JSON.stringify(state).match(
              /https:\/\/cdn\.grofers\.com\/[^"\s]+?\/cms\/product\/[^"\s]+?\.(?:png|jpe?g|webp)/g,
            ) ?? [],
          ),
        ];
        return {
          product: {
            ...product,
            ...item,
            images: photos.length ? photos.slice(0, 8) : product.images,
            variants: [],
          },
          pageDays: parseDeliveryDays(await read.etaText(page), now),
        };
      }),
  },
  bigbasket: {
    search: (lane, query) =>
      lane.run(async (page) => {
        if (!page.url().includes('bigbasket.com')) await open(page, 'https://www.bigbasket.com/');
        return bigbasketOffers(await read.bigbasketSearch(page, query));
      }),
    read: (lane, url, now) =>
      lane.run(async (page) => {
        const product = await captured(page, url);
        return groceryRead(url, bigbasketFamily(await read.nextData(page)), null, now, product);
      }),
  },
  zepto: generic(
    'zepto.com',
    (query) => `https://www.zepto.com/search?query=${q(query)}`,
    (id) => `https://www.zepto.com/pn/x/pvid/${id}`,
  ),
  instamart: generic(
    'swiggy.com',
    (query) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${q(query)}`,
    (id) => `https://www.swiggy.com/instamart/item/${id}`,
  ),
};

/** A shop read by the shape of its data (genericOffers): its search page, its item pages. */
function generic(
  site: string,
  searchUrl: (query: string) => string,
  itemUrl: (id: string) => string,
): Shop {
  const offersOn = async (page: Page, url: string) => {
    const json = read.collectJson(page, site);
    await open(page, url);
    await page.waitForTimeout(2500); // the results arrive after the page
    const eta = await read.etaText(page);
    return {
      offers: genericOffers(await json.done(), await read.bodyText(page), site, itemUrl, eta),
      eta,
    };
  };
  return {
    search: (lane, query) =>
      lane.run(async (page) => (await offersOn(page, searchUrl(query))).offers),
    read: (lane, url, now) =>
      lane.run(async (page) => {
        const { offers, eta } = await offersOn(page, url);
        const raw = rawCaptureSchema.safeParse(await page.evaluate(captureScript));
        return groceryRead(url, offers, eta, now, raw.success ? normalizeCapture(raw.data) : null);
      }),
  };
}

export const shopFor = (reader: ShopReader | null): Shop =>
  reader ? SHOPS[reader] : { search: async () => [], read: capturedRead() };
