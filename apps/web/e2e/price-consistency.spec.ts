import { expect, test, type Page } from '@playwright/test';

import { serviceClient, stripeTestKeysPresent } from './env';
import { fillCheckoutDetails, ownCaller } from './pay';

/**
 * Launch QA plan B-1, §8 item 2: on a piece whose options cost different amounts, the product page says "From $x"
 * (the lowest in-stock price, or the range) until an option is picked, then that option's price; and the price shown
 * is the bag line and the checkout line. Up to 10 such pieces from this database (the demo catalogue locally).
 *
 * The price is found by its test id `product-price` once the product page has it, else as the line that starts with
 * "$" or "From $" (today's page has no id on it).
 */

const usd = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Names may be shown title-cased (B-9), so they are matched without case. */
const named = (name: string): RegExp => new RegExp(escape(name.trim()), 'i');
const exactly = (text: string): RegExp => new RegExp(`^\\s*${escape(text.trim())}\\s*$`, 'i');

interface Option {
  id: string;
  label: string;
  options: Record<string, unknown>;
  price_cents: number;
}
interface Piece {
  name: string;
  path: string;
  pick: Option; // an in-stock option priced unlike the first in-stock one (the one the page used to show)
  min: number;
  max: number;
}

/** Up to `limit` live pieces with two or more in-stock options at different prices. */
async function multiPricePieces(limit: number): Promise<Piece[]> {
  const service = serviceClient();
  const { data: variants, error } = await service
    .from('store_variants')
    .select('id, product_id, label, options, price_cents, available, sort_order')
    .gt('available', 0)
    .order('sort_order')
    .order('label')
    .limit(5000);
  if (error) throw error;
  const byProduct = new Map<string, Option[]>();
  for (const v of variants) {
    if (v.price_cents === null) continue;
    const list = byProduct.get(v.product_id) ?? [];
    list.push({ id: v.id, label: v.label, options: (v.options ?? {}) as Record<string, unknown>, price_cents: v.price_cents });
    byProduct.set(v.product_id, list);
  }
  const ids = [...byProduct].filter(([, list]) => new Set(list.map((o) => o.price_cents)).size > 1).map(([id]) => id);
  if (ids.length === 0) return [];
  const { data: products, error: productError } = await service
    .from('store_products')
    .select('id, name, slug, region_slug')
    .in('id', ids.slice(0, 200));
  if (productError) throw productError;
  return products
    .filter((p) => p.slug && p.id && p.name)
    .slice(0, limit)
    .map((p) => {
      const list = byProduct.get(p.id!)!;
      const first = list[0]!;
      const prices = list.map((o) => o.price_cents);
      return {
        name: p.name!,
        path: `/states/${p.region_slug ?? 'india'}/${p.slug}`,
        pick: list.find((o) => o.price_cents !== first.price_cents)!,
        min: Math.min(...prices),
        max: Math.max(...prices),
      };
    });
}

const priceLine = (page: Page) =>
  page
    .getByTestId('product-price')
    .or(page.getByRole('main').locator('p').filter({ hasText: /^\s*(From )?\$[\d,]+\.\d\d/ }))
    .first();

/** Picks an option the way a customer does: its own button, or each of its colour / size values. */
async function pickOption(page: Page, option: Option): Promise<void> {
  const choices = page.getByRole('main').getByRole('group');
  const byLabel = choices.getByRole('button', { name: exactly(option.label) });
  if ((await byLabel.count()) > 0) {
    await byLabel.first().click();
    return;
  }
  for (const value of Object.values(option.options)) {
    if (typeof value !== 'string') continue;
    const button = choices.getByRole('button', { name: exactly(value) });
    if ((await button.count()) > 0) await button.first().click();
  }
}

test('options at different prices: "From" before a pick; shown = bag line = checkout line (B-1)', async ({ page }) => {
  test.setTimeout(240_000);
  const pieces = await multiPricePieces(10);
  test.skip(pieces.length === 0, 'No live piece with options at different prices in this database');

  for (const piece of pieces) {
    await page.goto(piece.path);
    const min = escape(usd(piece.min));
    const max = escape(usd(piece.max));
    // Before a pick: the lowest price as "From $x", or the range; never just the first option's price.
    await expect(priceLine(page), piece.path).toHaveText(new RegExp(`^\\s*(From ${min}|${min}\\s*[–-]\\s*${max})`));
    await pickOption(page, piece.pick);
    await expect(priceLine(page), `${piece.path} after picking ${piece.pick.label}`).toHaveText(
      new RegExp(`^\\s*${escape(usd(piece.pick.price_cents))}\\s*$`),
    );
    await page.getByRole('button', { name: 'Add to bag' }).filter({ visible: true }).first().click();
    await expect(page.getByRole('link', { name: 'View bag' })).toBeVisible();
  }

  // The bag: each line at the price the page showed.
  await page.goto('/cart');
  for (const piece of pieces) {
    const line = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: named(piece.name) }) });
    await expect(line.first(), `bag line of ${piece.name}`).toContainText(usd(piece.pick.price_cents));
  }

  // Checkout: the server's price for each line is the same.
  if (!stripeTestKeysPresent()) {
    test.info().annotations.push({ type: 'partly skipped', description: 'Stripe test keys are not set: the bag was checked, checkout was not' });
    return;
  }
  await ownCaller(page);
  await fillCheckoutDetails(page);
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(page.getByText('Estimated delivery:').first()).toBeVisible({ timeout: 30_000 });
  const summary = page.getByRole('complementary', { name: 'Your bag' });
  for (const piece of pieces) {
    const line = summary.getByRole('listitem').filter({ hasText: named(piece.name) });
    await expect(line.first(), `checkout line of ${piece.name}`).toContainText(usd(piece.pick.price_cents));
  }
});
