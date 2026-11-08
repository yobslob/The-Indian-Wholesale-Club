import { expect, test, type Page } from '@playwright/test';

import { E2E_ADMIN } from './env';

/** D-194: the two demo listings with looks (supabase/seed/demo.sql). Their photo files don't exist locally. */
const KURTA = '/states/punjab/demo-looks-kurta';
const MASALA = '/states/punjab/demo-looks-masala';
const SINGLE_LOOK = '/states/kerala/demo-kerala-kasavu-saree';

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Every photo answers with a pixel, so a picture's own frame is what is measured. */
async function answerPhotos(page: Page): Promise<void> {
  await page.route(/\/media\//, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
}

const mainPhoto = (page: Page) => page.getByRole('button', { name: /^Open photo 1 of / });
/** The path of the main photo as its <img> asks for it. */
const mainPath = async (page: Page): Promise<string> => (await mainPhoto(page).locator('img').getAttribute('src')) ?? '';

/** The main photo's box on the page, wherever the page is scrolled to. */
const mainBox = (page: Page) =>
  mainPhoto(page).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height, page: document.documentElement.scrollHeight };
  });

/** Taps a chip until the page answers: a tap before the page is ready does nothing, and a chip may already be pressed. */
async function pickLook(page: Page, name: string, photo: string): Promise<void> {
  const chip = page.getByRole('button', { name, exact: true }).first();
  await expect(async () => {
    await chip.click();
    await expect.poll(() => mainPath(page), { timeout: 1000 }).toContain(photo);
  }).toPass({ timeout: 15_000 });
}

test('a colour shows its own photo, a size changes nothing, and nothing on the page moves', async ({ page }) => {
  await answerPhotos(page);
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto(KURTA);
  // shared main photo: the page opens exactly as before
  expect(await mainPath(page)).toContain('/s/main.');
  await expect(mainPhoto(page)).toHaveAttribute('aria-label', 'Open photo 1 of 4');
  const before = await mainBox(page);

  await pickLook(page, 'Maroon', '/s/maroon.');
  await expect(mainPhoto(page)).toHaveAttribute('aria-label', 'Open photo 1 of 3');
  expect(await mainBox(page)).toEqual(before);

  await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Size: M' })).toBeVisible();
  expect(await mainPath(page)).toContain('/s/maroon.');

  await pickLook(page, 'Navy', '/s/navy.');
  expect(await mainBox(page)).toEqual(before);
});

test('the viewer opens on the photos of the picked look', async ({ page }) => {
  await answerPhotos(page);
  await page.goto(KURTA);
  await pickLook(page, 'Maroon', '/s/maroon.');
  await mainPhoto(page).click();
  const viewer = page.getByRole('dialog');
  await expect(viewer.getByText('1 / 3')).toBeVisible();
  const shown = await viewer.locator('img').evaluateAll((list) => list.map((i) => i.getAttribute('src') ?? ''));
  expect(shown.some((s) => s.includes('/s/maroon.'))).toBe(true);
  expect(shown.some((s) => s.includes('/s/navy.'))).toBe(false);
});

test('the bag line shows the photo of the picked look', async ({ page }) => {
  await answerPhotos(page);
  await page.goto(KURTA);
  await pickLook(page, 'Maroon', '/s/maroon.');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await expect(page.getByText('1 in your bag')).toBeVisible();
  const path = await page.evaluate(() => JSON.parse(localStorage.getItem('iwc-cart') ?? '{}').state.lines[0].imagePath as string);
  expect(path).toContain('/s/maroon.');
});

test('a pack shows its photo, and a pack without one keeps the photos as they are', async ({ page }) => {
  await answerPhotos(page);
  await page.goto(MASALA);
  expect(await mainPath(page)).toContain('/s/main.');
  await pickLook(page, 'Family pack', '/s/family.');
  await pickLook(page, 'Single', '/s/main.');
  await expect(mainPhoto(page)).toHaveAttribute('aria-label', 'Open photo 1 of 2');
});

test('a listing without looks has no change at all', async ({ page }) => {
  await answerPhotos(page);
  await page.goto(SINGLE_LOOK);
  await expect(page.getByRole('button', { name: 'Add to bag' }).first()).toBeVisible();
  await expect(page.locator('.look-in')).toHaveCount(0);
});

test('on a card, a colour shows its photo until the ribbon closes, and the bag line keeps it', async ({ page }) => {
  await answerPhotos(page);
  await page.goto('/clothing?category=kurtas');
  const plus = page.getByRole('button', { name: 'Choose a size of Demo Looks Kurta' });
  await plus.scrollIntoViewIfNeeded();
  await plus.click();
  const ribbon = page.getByRole('dialog', { name: 'Choose for Demo Looks Kurta' });
  await expect(ribbon).toBeVisible();
  await expect(page.getByTestId('card-look')).toHaveCount(0);

  await ribbon.getByRole('button', { name: 'Maroon' }).click();
  await expect(page.getByTestId('card-look').locator('img')).toHaveAttribute('src', /\/s\/maroon\./);

  await page.keyboard.press('Escape');
  await expect(page.getByTestId('card-look')).toHaveCount(0);

  await plus.click();
  await ribbon.getByRole('button', { name: 'Maroon' }).click();
  await ribbon.getByRole('button', { name: /^M\b/ }).click();
  await expect(page.getByRole('group', { name: 'Demo Looks Kurta: 1 in your bag' })).toBeVisible();
  const path = await page.evaluate(() => JSON.parse(localStorage.getItem('iwc-cart') ?? '{}').state.lines[0].imagePath as string);
  expect(path).toContain('/s/maroon.');
});

test('in the admin panel a photo can be one look’s or every look’s', async ({ page }) => {
  await answerPhotos(page);
  await page.goto('/admin');
  await page.getByLabel('Email').fill(E2E_ADMIN.email);
  await page.getByLabel('Password').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  await page.goto('/admin/catalog/00000000-0000-4000-8000-000000000301');
  const forms = page.locator('form').filter({ has: page.getByRole('combobox', { name: 'For' }) });
  const chosen = (n: number) => forms.nth(n).getByRole('combobox', { name: 'For' }).locator('option:checked');
  const choose = async (label: string, shows: string): Promise<void> => {
    await forms.nth(1).getByRole('combobox', { name: 'For' }).selectOption({ label });
    await forms.nth(1).getByRole('button', { name: 'Save' }).click();
    await expect(async () => {
      await page.reload();
      await expect(chosen(1)).toHaveText(shows, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  };
  await expect(chosen(1)).toHaveText('Every look');
  await expect(chosen(2)).toHaveText('Navy');
  await choose('Maroon', 'Maroon');
  await choose('Every look', 'Every look');
});
