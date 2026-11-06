import { expect, type APIRequestContext } from '@playwright/test';

import { DEMO_PRODUCT, E2E_ADMIN, serviceClient } from './env';

/**
 * Sets the demo product's pieces left (the first variant gets `left`, the others `others`), then refreshes the store,
 * as a stock correction made straight in the database by the app admin does (B-17).
 */
export async function setDemoStock(request: APIRequestContext, left: number, others = 0): Promise<void> {
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
      p_note: 'E2E stock (local only)',
    });
    if (setError) throw setError;
  }
  const { createClient } = await import('@supabase/supabase-js');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  const { data, error: signInError } = await auth.auth.signInWithPassword(E2E_ADMIN);
  if (signInError || !data.session) throw signInError ?? new Error('no admin session');
  const res = await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${data.session.access_token}` }, data: { all: true } });
  expect(res.status()).toBe(200);
}

/** As global setup leaves the demo product, for the flows after a test that changed it. */
export const restoreDemoStock = (request: APIRequestContext): Promise<void> => setDemoStock(request, 5, 5);
