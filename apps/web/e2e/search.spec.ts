import { expect, test } from '@playwright/test';

/**
 * Search (D-160): a misspelt word is read as the word the listings use and says so; the header's box suggests while
 * typing (loaded on focus, from the CDN-kept hints) and works by keyboard: ↓ picks, Enter searches it.
 */
test('a misspelt search shows the pieces for the word the store uses', async ({ page }) => {
  await page.goto('/search?q=kasvu%20saree');
  await expect(page.getByText('No pieces match “kasvu saree”. Showing pieces for “kasavu saree”.')).toBeVisible();
  await expect(page.getByRole('main').getByText('Demo Kasavu Saree')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('the header box suggests while typing; the arrow and Enter take a suggestion', async ({ page }) => {
  await page.goto('/clothing');
  const box = page.locator('.site-search input').first();
  await box.click();
  await box.pressSequentially('kasa');
  const list = page.getByRole('listbox', { name: 'Suggestions' });
  await expect(list.getByRole('option', { name: 'kasavu' })).toBeVisible();
  await expect(box).toHaveAttribute('aria-expanded', 'true');
  await box.press('ArrowDown');
  await expect(box).toHaveAttribute('aria-activedescendant', /-0$/);
  await box.press('Enter');
  await expect(page).toHaveURL(/\/search\?q=kasavu$/);
  await expect(page.getByRole('main').getByText('Demo Kasavu Saree')).toBeVisible();
});

test('the filters narrow a search with their counts, as links', async ({ page }) => {
  await page.goto('/search?q=saree');
  const filters = page.getByRole('navigation', { name: 'Filter the results' });
  await filters.getByText(/^Sort: Best match/).click();
  await filters.getByRole('link', { name: 'Price: low to high' }).click();
  await expect(page).toHaveURL(/sort=price-asc/);
  const categories = page.getByRole('navigation', { name: 'Categories' });
  if (await categories.isVisible()) {
    await categories.getByRole('link').first().click();
    await expect(page).toHaveURL(/category=/);
  }
});
