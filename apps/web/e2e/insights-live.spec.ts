import { expect, test, type Page } from '@playwright/test';

import { E2E_ADMIN, E2E_CUSTOMER, serviceClient } from './env';

/** Flow 7 (C7): Insights shows real searches, and Today shows order changes live (Realtime). */

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ })).toBeVisible();
}

test('a search that finds nothing shows in Insights as something to list', async ({ page }) => {
  const words = `zzz e2e ${Date.now().toString(36)}`;
  await page.goto(`/search?q=${encodeURIComponent(words)}`);
  await expect(page.getByText(`No products match “${words}”.`)).toBeVisible();

  await signInAsAdmin(page);
  await page.goto('/admin/insights?period=30');
  const empty = page.locator('section').filter({ hasText: 'Searched for, found nothing' });
  await expect(empty.getByText(words, { exact: true })).toBeVisible();
  await expect(page.getByText('in pieces sold (before tax and shipping)')).toBeVisible();
});

test('Today shows an order change live, without a reload', async ({ page }) => {
  const { data: order, error } = await serviceClient()
    .from('orders')
    .select('id, order_number')
    .eq('email', E2E_CUSTOMER.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  test.skip(Boolean(error) || !order, 'needs an order from flow 1 or 6');

  await signInAsAdmin(page);
  await expect(page.getByText('· connected')).toBeVisible({ timeout: 20_000 });
  const { error: updateError } = await serviceClient()
    .from('orders')
    .update({ notes: `E2E live ${Date.now()}` })
    .eq('id', order!.id);
  if (updateError) throw updateError;
  await expect(page.getByText(new RegExp(`${order!.order_number} is now`))).toBeVisible({ timeout: 20_000 });
});

test('the app admin can refresh the store pages; nobody else can (B-17)', async ({ request }) => {
  const { createClient } = await import('@supabase/supabase-js');
  const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '');
  const token = async (email: string, password: string): Promise<string> => {
    const { data, error } = await auth.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error ?? new Error('no session');
    return data.session.access_token;
  };

  expect((await request.post('/admin/revalidate')).status()).toBe(404);
  const customer = await token(E2E_CUSTOMER.email, E2E_CUSTOMER.password);
  expect((await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${customer}` } })).status()).toBe(404);
  const admin = await token(E2E_ADMIN.email, E2E_ADMIN.password);
  const ok = await request.post('/admin/revalidate', { headers: { authorization: `Bearer ${admin}` } });
  expect(ok.status()).toBe(200);
});
