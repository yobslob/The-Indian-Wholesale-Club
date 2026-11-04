import { expect, test } from '@playwright/test';

import { stripeTestKeysPresent } from './env';
import { addDemoToBag, continueToPayment, fillCheckoutDetails, ownCaller, payButton } from './pay';
import { restoreDemoStock, setDemoStock } from './stock';

/**
 * §10 Y-3, the founder: "show it at checkout and also show which product is unavailable and give a remove option". A line
 * that is sold out or has fewer left than the bag asks is listed at the top of checkout with Remove or Keep n; payment
 * stays locked until it is fixed, and the totals re-price at once. create_order's own check stays for the rare race
 * (sold-out-paying.spec.ts).
 */
test.describe('stock at checkout', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!stripeTestKeysPresent(), 'Stripe test keys are not set in apps/web/.env.local');
    await ownCaller(page);
    await restoreDemoStock(request);
  });
  test.afterEach(async ({ request }) => {
    await restoreDemoStock(request);
  });

  const list = (page: import('@playwright/test').Page) => page.getByRole('alert', { name: 'Pieces to sort out' });

  test('sold out when checkout opens: named at the top, Remove empties the bag', async ({ page, request }) => {
    await addDemoToBag(page);
    await setDemoStock(request, 0, 0);
    await page.goto('/checkout');
    await expect(list(page)).toBeVisible();
    await expect(list(page).getByText('Not available right now')).toBeVisible();
    await expect(list(page).getByRole('button', { name: /^Keep/ })).toHaveCount(0);
    await expect(list(page).locator('[aria-hidden="true"]').first()).toBeAttached(); // the photo's box
    await list(page).getByRole('button', { name: /^Remove/ }).click();
    await expect(list(page)).toHaveCount(0);
    await expect(page.getByText(/Lighter than a tiffin/)).toBeVisible();
  });

  test('fewer left when checkout opens: Only 2 left, Keep 2 lowers the line', async ({ page, request }) => {
    await addDemoToBag(page);
    const added = page.getByRole('button', { name: 'One more' });
    await added.click();
    await added.click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click(); // 1 + 3 = 4 in the bag
    await setDemoStock(request, 2, 0);
    await page.goto('/checkout');
    await expect(list(page).getByText('Only 2 left')).toBeVisible();
    await list(page).getByRole('button', { name: 'Keep 2' }).click();
    await expect(list(page)).toHaveCount(0);
    await expect(page.getByText(/× 2/).first()).toBeAttached();
  });

  test('payment stays locked until it is fixed, then the bag is priced again at once', async ({ page, request }) => {
    test.setTimeout(120_000);
    await addDemoToBag(page);
    const more = page.getByRole('button', { name: 'One more' });
    await more.click();
    await more.click();
    await page.getByRole('button', { name: 'Add to bag' }).first().click();
    await fillCheckoutDetails(page);
    await setDemoStock(request, 2, 0); // it changes after checkout opened: the re-price finds it

    await continueToPayment(page).click();
    await expect(list(page).getByText('Only 2 left')).toBeVisible({ timeout: 30_000 });
    await expect(payButton(page)).toHaveCount(0);

    await list(page).getByRole('button', { name: 'Keep 2' }).click();
    await expect(list(page)).toHaveCount(0);
    await expect(payButton(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/× 2/).first()).toBeAttached();
  });
});
