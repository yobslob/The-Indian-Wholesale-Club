import { expect, test } from '@playwright/test';

import { DEMO_PRODUCT } from './env';

/**
 * Flow 4 (coding plan C1 "done when", design.md §Accessibility, D-049 guard rails): motion is progressive
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
    const firstCard = page.locator('section[aria-labelledby="just-listed"] [data-reveal]').first();
    await expect(firstCard).toHaveAttribute('data-reveal', 'pending');
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
    const sizeChart = page.getByRole('button', { name: 'Size chart' });
    await sizeChart.focus();
    await page.keyboard.press('Enter');
    await expect(sizeChart).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(sizeChart).toHaveAttribute('aria-expanded', 'false');
    const heart = page.getByRole('button', { name: 'Save for later' });
    await heart.focus();
    await expect(heart).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/login\?next=/); // signed out: saving asks to sign in first
  });
});
