import {
  captureScript,
  normalizeCapture,
  parseDeliveryDays,
  rawCaptureSchema,
  type SourcedProduct,
} from '@repo/shared/sourcing';
import {
  amazonSearchOffers,
  amazonSearchUrl,
  bigbasketFamily,
  bigbasketOffers,
  blinkitItem,
  blinkitOffers,
  flipkartSearchOffers,
  flipkartSearchUrl,
  flightRows,
  instamartOffers,
  itemKeyOf,
  myntraSearchOffers,
  newmeCollection,
  newmeCollectionUrl,
  newmePieces,
  newmeProduct,
  newmeSearchOffers,
  packVariants,
  refusedWith,
  searchPages,
  shopifyProduct,
  shopifyProductJsUrl,
  shopifySearchOffers,
  shopifySearchUrl,
  type Offer,
  type ShopReader,
  zeptoOffers,
} from '@repo/shared/sourcing/auto';

import { open, RobotCheck, type Lane } from './lanes';
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

const band = (hint?: SearchHint) => ({
  minPaise: hint?.minPaise ?? null,
  maxPaise: hint?.maxPaise ?? null,
});

/**
 * D-137: a marketplace's results, page after page (each its own turn on the shop's lane, so the pause between pages
 * holds), as many as the target wants (searchPages); stops at a page that brings nothing new.
 */
async function paged(
  lane: Lane,
  hint: SearchHint | undefined,
  readPage: (page: Page, n: number) => Promise<Offer[]>,
): Promise<Offer[]> {
  const all: Offer[] = [];
  const seen = new Set<string>();
  for (let n = 1; n <= searchPages(hint?.want ?? 0); n += 1) {
    const offers = await lane.run((page) => readPage(page, n));
    const fresh = offers.filter((o) => !seen.has(o.key));
    for (const o of fresh) seen.add(o.key);
    all.push(...fresh);
    if (!fresh.length) break;
  }
  return all;
}

const AMAZON_NONE = /no results for|did not match any products/i;
const FLIPKART_NONE = /sorry, no results found|no results found/i;

/**
 * D-137: a first results page with no rows that does not say "no results" did not load (slow, or a page in between):
 * a failed search, so the target is searched again, not marked as nothing found.
 */
async function loaded(page: Page, n: number, offers: Offer[], none: RegExp): Promise<Offer[]> {
  if (offers.length || n > 1) return offers;
  const shown = (await page.evaluate(
    "document.body ? document.body.innerText.slice(0, 6000) : ''",
  )) as string;
  if (none.test(shown)) return offers;
  throw new Error('the results page did not load');
}

const ZEPTO_SEARCH = /\/user-search-service\/api\/v\d+\/search(?:\?|$)/;
const INSTAMART_SEARCH = /\/api\/instamart\/search\/v\d+\?/;

/**
 * D-152: Zepto's and Instamart's results come in the search's own answer after the page opens (Instamart's after its
 * AWS check reloads the page by itself), so the reader waits for that answer. None in time: a failed search (D-137).
 */
async function answer(
  page: Page,
  url: string,
  api: RegExp,
): Promise<{ json: unknown; eta: string | null }> {
  const arrived = page.waitForResponse((r) => api.test(r.url()) && r.ok(), { timeout: 30_000 });
  arrived.catch(() => undefined);
  await open(page, url);
  const json: unknown = await arrived.then((r) => r.json()).catch(() => null);
  if (json === null) throw new Error('the results page did not load');
  // Instamart's "too many requests" comes inside a 200 answer, behind "Log in to continue": a 429 (D-153)
  if (refusedWith(json)) throw new RobotCheck(new URL(url).hostname.replace(/^www\./, ''), 0);
  return { json, eta: await read.etaText(page) };
}

const SHOPS: Record<ShopReader, Shop> = {
  amazon: {
    search: (lane, query, hint) =>
      paged(lane, hint, async (page, n) => {
        await open(
          page,
          amazonSearchUrl(query, band(hint), n),
          'div[data-component-type="s-search-result"]',
        );
        return loaded(page, n, amazonSearchOffers(await read.amazonRows(page)), AMAZON_NONE);
      }),
    read: capturedRead('#productTitle'),
  },
  flipkart: {
    search: (lane, query, hint) =>
      paged(lane, hint, async (page, n) => {
        await open(page, flipkartSearchUrl(query, band(hint), n), 'div[data-id]');
        return loaded(page, n, flipkartSearchOffers(await read.flipkartCards(page)), FLIPKART_NONE);
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
  newme: {
    // D-170: "collection:dresses pages:1-4", each page its own turn on the lane; a page with nothing on it ends it
    search: async (lane, query) => {
      const c = newmeCollection(query);
      if (!c) return [];
      const all: Offer[] = [];
      for (let n = c.from; n <= c.to; n += 1) {
        const shown = await lane.run(async (page) => {
          await open(page, newmeCollectionUrl(c.handle, n));
          const data = await read.nextData(page);
          if (data === null) throw new Error('the results page did not load');
          return { offers: newmeSearchOffers(data), pieces: newmePieces(data) };
        });
        if (!shown.pieces) break;
        all.push(...shown.offers.filter((o) => !all.some((x) => x.key === o.key)));
      }
      return all;
    },
    read: (lane, url, now) =>
      lane.run(async (page) => {
        await open(page, url);
        const piece = newmeProduct(await read.nextData(page), url);
        return {
          product: piece?.product ?? null,
          pageDays: parseDeliveryDays(piece?.deliveryText, now),
        };
      }),
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
  zepto: {
    search: (lane, query) =>
      lane.run(async (page) => {
        const { json, eta } = await answer(
          page,
          `https://www.zepto.com/search?query=${q(query)}`,
          ZEPTO_SEARCH,
        );
        return zeptoOffers(json, eta);
      }),
    read: (lane, url, now) =>
      lane.run(async (page) => {
        const product = await captured(page, url);
        const eta = await read.etaText(page);
        const offers = zeptoOffers(flightRows(await read.nextFlight(page)), eta);
        return groceryRead(url, offers, eta, now, product);
      }),
  },
  instamart: {
    search: (lane, query) =>
      lane.run(async (page) => {
        const { json, eta } = await answer(
          page,
          `https://www.swiggy.com/instamart/search?custom_back=true&query=${q(query)}`,
          INSTAMART_SEARCH,
        );
        return instamartOffers(json, eta);
      }),
    read: (lane, url, now) =>
      lane.run(async (page) => {
        const product = await captured(page, url);
        const eta = await read.etaText(page);
        const offers = instamartOffers(await read.instamartItem(page), eta);
        return groceryRead(url, offers, eta, now, product);
      }),
  },
};

export const shopFor = (reader: ShopReader | null): Shop =>
  reader ? SHOPS[reader] : { search: async () => [], read: capturedRead() };
