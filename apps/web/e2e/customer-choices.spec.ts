import { expect, test, type Page } from '@playwright/test';

import { buyDemoProduct, openOrderAsGuest } from './buy';
import { E2E_ADMIN, E2E_CUSTOMER, serviceClient, stripeTestKeysPresent } from './env';

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
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
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

test('before the cutoff, a customer cancels and gets everything but the tax back (D-042)', async ({ page }) => {
  test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
  const orderNumber = await buyDemoProduct(page);
  await openOrderAsGuest(page, orderNumber);

  await expect(page.getByRole('heading', { name: 'Changed your mind?' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel my order' }).click();
  await page.getByRole('button', { name: /^Yes, cancel and refund \$/ }).click();
  await expect(page.getByText('Your order is cancelled. The refund is on its way.')).toBeVisible({ timeout: 30_000 });

  const order = await orderRow(orderNumber);
  expect(order.status).toBe('cancelled');
  expect(order.refunded_cents).toBe(order.total_cents - order.tax_cents);
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
  const estimate = page.locator('form').filter({ hasText: 'New delivery estimate' });
  await estimate.locator('input[name="from"]').fill(isoDay(60));
  await estimate.locator('input[name="to"]').fill(isoDay(64));
  await estimate.locator('input[name="note"]').fill('E2E: export slipped');
  await estimate.getByRole('button', { name: 'Change window' }).click();
  await expect(page.getByText(`${isoDay(60)} → ${isoDay(64)}`)).toBeVisible();

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
  await expect(page.getByText('not decided yet (Q-30)')).toBeVisible();
  const csv = await page.request.get(`/admin/cycles/${cycle.id}/csv/invoice`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('TO FILL (Q-30)');
});
