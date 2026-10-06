import { expect, test, type APIRequestContext } from '@playwright/test';

import { buyDemoProduct } from './buy';
import { DEMO_PRODUCT, E2E_ADMIN, serviceClient, stripeTestKeysPresent } from './env';

/**
 * Flow 8 (engineering.md §Caching): a sale refreshes the cached pages that show its stock. The demo product is left
 * with one piece; once it is bought, the product and region pages say "Sold out" on the very next request, in the
 * server's HTML (no browser script involved), not after the 5-minute fallback.
 */

const PRODUCT_URL = `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`;

/** Sets the demo product's pieces left (the first variant gets `left`, the others none), then refreshes the store. */
async function setDemoStock(request: APIRequestContext, left: number, others = 0): Promise<void> {
  const service = serviceClient();
  const { data: variants, error } = await service
    .from('product_variants')
    .select('id, qty_reserved, sort_order, product:products!inner(slug)')
    .eq('product.slug', DEMO_PRODUCT.slug)
    .order('sort_order')
    .order('id');
  if (error) throw error;
  for (const [i, v] of variants.entries()) {
    const { error: setError } = await service.rpc('admin_set_listed_qty', {
      p_variant: v.id,
      p_qty_listed: v.qty_reserved + (i === 0 ? left : others),
      p_note: 'E2E sold-out flow (local only)',
    });
    if (setError) throw setError;
  }
  // A stock correction made straight in the database (as the app admin does) refreshes the store through B-17.
  const { createClient } = await import('@supabase/supabase-js');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  const { data, error: signInError } = await auth.auth.signInWithPassword(E2E_ADMIN);
  if (signInError || !data.session) throw signInError ?? new Error('no admin session');
  const res = await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${data.session.access_token}` } });
  expect(res.status()).toBe(200);
}

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
