import { expect, test, type Page } from '@playwright/test';

import { buyDemoProduct, openOrderAsGuest } from './buy';
import { DEMO_PRODUCT, E2E_ADMIN, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

/**
 * Flow 6 (C4, C5): what a customer may decide on their order, and the cycle pages behind it. Nothing here changes a
 * cycle's status, so it can run against a local database mid-cycle. A whole cycle is covered in SQL
 * (supabase/tests/cycle_lifecycle.test.sql).
 */

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.locator('input[name="email"]').fill(E2E_ADMIN.email);
  await page.locator('input[name="password"]').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /^Good (morning|afternoon|evening)$/ })).toBeVisible();
}

async function orderRow(orderNumber: string) {
  const { data, error } = await serviceClient()
    .from('orders')
    .select('id, status, total_cents, tax_cents, refunded_cents')
    .eq('order_number', orderNumber)
    .single();
  if (error) throw error;
  return data;
}

const isoDay = (days: number): string => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
/** As the admin shows a calendar day (features/admin/time.ts): "Dec 7". */
const shortDay = (days: number): string =>
  new Date(`${isoDay(days)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

test('before its pieces are collected, a customer cancels and gets everything back (D-072)', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const orderNumber = await buyDemoProduct(page);
  await openOrderAsGuest(page, orderNumber);

  await expect(page.getByRole('heading', { name: 'Changed your mind?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel my order' }).click();
  await page.getByRole('button', { name: /^Yes, cancel and refund \$/ }).click();
  await expect(page.getByText('Your order is cancelled. The refund is on its way.')).toBeVisible({ timeout: 30_000 });

  const order = await orderRow(orderNumber);
  expect(order.status).toBe('cancelled');
  expect(order.refunded_cents).toBe(order.total_cents);
  const { data: emails } = await serviceClient()
    .from('email_outbox')
    .select('payload')
    .eq('kind', 'order_update')
    .eq('recipient', E2E_CUSTOMER.email)
    .contains('payload', { orderNumber, kind: 'order_cancelled' });
  expect(emails?.length).toBe(1); // B-20: the cancellation is emailed
});

test('after a later delivery date, the customer keeps the order (D-008)', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const orderNumber = await buyDemoProduct(page);
  const { id } = await orderRow(orderNumber);

  await signInAsAdmin(page);
  await page.goto(`/admin/orders/${id}`);
  await page.getByRole('button', { name: 'New delivery date…' }).click();
  const estimate = page.getByRole('dialog', { name: 'New delivery date' });
  await estimate.locator('input[name="from"]').fill(isoDay(60));
  await estimate.locator('input[name="to"]').fill(isoDay(64));
  await estimate.locator('input[name="note"]').fill('E2E: export slipped');
  await estimate.getByRole('button', { name: 'Change window' }).click();
  await expect(page.getByText(`${shortDay(60)} – ${shortDay(64)}`)).toBeVisible();

  await openOrderAsGuest(page, orderNumber);
  await expect(page.getByRole('heading', { name: 'Your delivery date moved' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep my order' }).click();
  await expect(page.getByText('Thanks. Your order stays with the new date.')).toBeVisible({ timeout: 30_000 });

  const { data: kept } = await serviceClient()
    .from('order_events')
    .select('id')
    .eq('order_id', id)
    .eq('kind', 'delay_kept');
  expect(kept?.length).toBe(1);
});

test('a delivered piece is returned: asked on the order page, received and refunded by an admin (D-071)', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const orderNumber = await buyDemoProduct(page);
  const { id } = await orderRow(orderNumber);
  // Delivered two days ago (the steps in between are covered in SQL, cycle_lifecycle.test.sql).
  const service = serviceClient();
  const { error: statusError } = await service.from('orders').update({ status: 'delivered' }).eq('id', id);
  if (statusError) throw statusError;
  const { error: eventError } = await service.from('order_events').insert({
    order_id: id,
    kind: 'delivered',
    visible_to_customer: true,
    created_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  });
  if (eventError) throw eventError;

  await openOrderAsGuest(page, orderNumber);
  await expect(page.getByRole('heading', { name: 'Return a piece' })).toBeVisible();
  await page.getByRole('button', { name: /^I changed my mind: \$/ }).click();
  await page.getByRole('button', { name: /^Yes, return it for \$/ }).click();
  await expect(page.getByText('Thanks. We will be in touch to collect it from your door.', { exact: false })).toBeVisible({
    timeout: 30_000,
  });
  const { data: ret, error } = await service.from('returns').select('id, refund_cents, kept_pct').eq('order_id', id).single();
  if (error) throw error;
  expect(Number(ret.kept_pct)).toBeGreaterThan(0); // a change of mind keeps a share for fetching it back

  await signInAsAdmin(page);
  await page.goto('/admin/returns');
  const row = page.locator('tr').filter({ hasText: orderNumber });
  await row.getByRole('button', { name: 'Received' }).click();
  await expect(row).toHaveCount(0, { timeout: 30_000 }); // the action finished: it left the "requested" list
  await page.goto('/admin/returns?status=received');
  await page.locator('tr').filter({ hasText: orderNumber }).getByRole('button', { name: /^Refund \$/ }).click();
  await expect.poll(async () => (await orderRow(orderNumber)).refunded_cents, { timeout: 30_000 }).toBe(ret.refund_cents);
  const { data: clearance } = await service
    .from('products')
    .select('id')
    .eq('is_us_stock', true)
    .eq('status', 'draft')
    .like('slug', `${DEMO_PRODUCT.slug}-us-%`);
  expect(clearance?.length).toBeGreaterThan(0); // the piece is a US clearance draft (D-072)
});

test('an admin opens the open cycle, its dates and its export documents (C4)', async ({ page }) => {
  const { data: cycle, error } = await serviceClient().from('cycles').select('id, code').eq('status', 'open').single();
  if (error) throw error;

  await signInAsAdmin(page);
  await page.goto(`/admin/cycles/${cycle.id}`);
  await expect(page.getByRole('heading', { name: `Cycle ${cycle.code}` })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save dates' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cut off now/ })).toBeVisible();

  await page.goto(`/admin/cycles/${cycle.id}/documents`);
  await expect(page.getByRole('heading', { name: 'Packing list' })).toBeVisible();
  await expect(page.getByText(/still a placeholder/)).toBeVisible();
  const csv = await page.request.get(`/admin/cycles/${cycle.id}/csv/invoice`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('FCA Mumbai airport (placeholder)');
});
