import { expect, test, type APIRequestContext } from '@playwright/test';

import { buyDemoProduct } from './buy';
import { DEMO_PRODUCT, stripeTestKeysPresent } from './env';
import { setDemoStock } from './stock';

/**
 * Flow 8 (engineering.md §Caching): a sale refreshes the cached pages that show its stock. The demo product is left
 * with one piece; once it is bought, the product and region pages say "Sold out" on the very next request, in the
 * server's HTML (no browser script involved), not after the 5-minute fallback.
 */

const PRODUCT_URL = `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`;

/** The server's HTML for a page: what the cache serves, before any script runs. */
const html = async (request: APIRequestContext, url: string): Promise<string> => (await request.get(url)).text();

test('buying the last piece shows "Sold out" on the cached pages at once', async ({ page, request }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');

  await setDemoStock(request, 1);
  // Warm the cache: these requests store the pages with one piece left.
  expect(await html(request, PRODUCT_URL)).toContain('Only 1 left');
  await html(request, `/states/${DEMO_PRODUCT.region}`);

  try {
    await buyDemoProduct(page);

    const product = await html(request, PRODUCT_URL);
    expect(product).toContain('Sold out');
    expect(product).not.toContain('Only 1 left');
    const region = await html(request, `/states/${DEMO_PRODUCT.region}`);
    const from = region.indexOf(`href="${PRODUCT_URL}"`);
    expect(from).toBeGreaterThan(-1);
    const card = region.slice(from, region.indexOf('</article>', from)); // this product's card only
    expect(card).toContain('Sold out');
  } finally {
    await setDemoStock(request, 5, 5); // as global setup leaves it, for the flows after this one
  }
});
