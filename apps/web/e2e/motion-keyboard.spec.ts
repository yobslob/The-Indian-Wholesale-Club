import { expect, test } from '@playwright/test';

import { DEMO_PRODUCT } from './env';

/**
 * Flow 4 (coding plan C1 "done when", storefront.md §Accessibility, D-049 guard rails): motion is progressive
 * enhancement (none with reduced motion, nothing hidden that is on screen) and the storefront works by keyboard.
 */
const product = `/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`;

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no smooth scrolling, nothing hidden for a reveal, no parallax', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);

    await page.goto(`/states/${DEMO_PRODUCT.region}`);
    await page.waitForLoadState('networkidle');
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    const transforms = await page.locator('[data-speed]').evaluateAll((els) => els.map((el) => (el as HTMLElement).style.transform));
    expect(transforms.every((t) => t === '')).toBe(true);
  });
});

test.describe('with motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('smooth scrolling runs, and images below the fold reveal once scrolled to', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveClass(/lenis/, { timeout: 15_000 });
    // launch QA C-2: Home's rows draw as they come near, after the first scroll
    await page.mouse.wheel(0, 400);
    const firstCard = page.locator('#just-listed [data-reveal]').first();
    await expect(firstCard).not.toHaveAttribute('data-reveal', 'in');
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toHaveAttribute('data-reveal', 'in');
  });
});

test.describe('keyboard', () => {
  test('skip link first; the hidden home logo shows when focused', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Tab');
    const logo = page.locator('.site-logo');
    await expect(logo).toBeFocused();
    await expect(logo).toHaveCSS('opacity', '1');
  });

  test('Pick your home: search filters by typing; a focused name lights its state at once', async ({ page }) => {
    await page.goto('/');
    // launch QA C-2: Pick your home is drawn as it comes near
    await page.locator('#pick').scrollIntoViewIfNeeded();
    const search = page.getByRole('searchbox', { name: 'Find your state' });
    await search.focus();
    await page.keyboard.type('pra');
    await expect(page.locator('[data-name]:visible')).toHaveCount(5); // Andhra, Arunachal, Himachal, Madhya, Uttar
    await search.fill('');
    await page.locator('a[data-slug="odisha"]').focus();
    await expect(page.locator('svg [data-slug="odisha"]').first()).toHaveAttribute('data-on', '');
  });

  test('product page: + / − sections and the heart work from the keyboard', async ({ page }) => {
    await page.goto(product);
    await page.waitForLoadState('networkidle'); // the sections answer keys once hydrated
    // launch QA B-3: Size chart shows only with real measurements, so take the first + / − section there is
    // (Details, which starts open): Enter and Space each flip it
    const section = page.getByRole('main').locator('button[aria-expanded]').first();
    const before = await section.getAttribute('aria-expanded');
    const flipped = before === 'true' ? 'false' : 'true';
    await section.focus();
    await page.keyboard.press('Enter');
    await expect(section).toHaveAttribute('aria-expanded', flipped);
    await page.keyboard.press('Space');
    await expect(section).toHaveAttribute('aria-expanded', before ?? 'false');
    const heart = page.getByRole('button', { name: 'Save for later' }).first();
    await heart.focus();
    await expect(heart).toBeFocused();
    await page.keyboard.press('Enter');
    // D-140 (F6): signed out, the piece is saved on this device at once (it joins the account after sign-in)
    await expect(page.getByRole('button', { name: 'Saved. Remove from saved' }).first()).toHaveAttribute('aria-pressed', 'true');
  });
});
