import { expect, test } from '@playwright/test';

/**
 * D-189: a scroll that starts on a card builds no product page; a finger resting on one still reads it ahead. Reading
 * ahead on touchstart stored the page of every card a thumb landed on (Vercel's page-cache writes).
 */
test('a scroll starting on a card reads nothing ahead; a resting finger does', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 800 } });
  const page = await context.newPage();
  await page.goto('/clothing');
  const card = page.locator('main a[href^="/states/"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute('href');
  expect(href).toBeTruthy();

  const readsAhead: string[] = [];
  page.on('request', (request) => {
    if (request.headers()['rsc'] && new URL(request.url()).pathname === href) readsAhead.push(request.url());
  });
  const wait = (): Promise<void> => page.waitForTimeout(500);

  await card.dispatchEvent('touchstart');
  await card.dispatchEvent('touchmove');
  await card.dispatchEvent('touchend');
  await wait();
  expect(readsAhead).toHaveLength(0);

  await card.dispatchEvent('touchstart');
  await wait();
  expect(readsAhead.length).toBeGreaterThan(0);
  await context.close();
});
