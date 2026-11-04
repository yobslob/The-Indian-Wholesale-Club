import { randomInt } from 'node:crypto';

import { expect, type Locator, type Page, type Response, type Route } from '@playwright/test';

import { clickPay } from './buy';
import { DEMO_PRODUCT, E2E_CUSTOMER, serviceClient } from './env';

/**
 * Checkout helpers for the launch QA tests (docs/archive/launch-qa-plan.md §8): the demo saree to the payment step, Stripe's
 * test cards, the 3-D Secure challenge, and what the server and Stripe say afterwards. Stripe test mode only: env.ts
 * refuses a live key before any test runs.
 */

/** Stripe's published test cards (https://docs.stripe.com/testing). */
export const CARDS = {
  ok: '4242 4242 4242 4242',
  threeDS: '4000 0027 6000 3184',
  declined: '4000 0000 0000 0002',
  insufficientFunds: '4000 0000 0000 9995',
} as const;

export interface CheckoutStart {
  clientSecret: string;
  paymentIntentId: string;
}

/**
 * /api/checkout and /api/orders share one rate limit per caller (20 a minute, lib/rate-limit-memory.ts), and the whole
 * suite comes from one address. Each test gets its own made-up caller on those two routes only (never on Stripe's
 * requests), so a test that prices the bag six times doesn't make the next one answer 429. Fault routes added later
 * pass requests on with `route.fallback()`, which ends here.
 */
export async function ownCaller(page: Page): Promise<void> {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  const handler = (route: Route) =>
    route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } });
  await page.route('**/api/checkout', handler);
  await page.route('**/api/orders', handler);
}

/** Every answer /api/checkout gave in this page, in order (one per pricing: Continue to payment, each shipping switch). */
export function watchCheckoutStarts(page: Page): CheckoutStart[] {
  const starts: CheckoutStart[] = [];
  page.on('response', (res: Response) => {
    if (!res.url().endsWith('/api/checkout') || res.request().method() !== 'POST' || !res.ok()) return;
    void res
      .json()
      .then((body: unknown) => {
        const b = body as Partial<CheckoutStart>;
        if (b.clientSecret && b.paymentIntentId) starts.push({ clientSecret: b.clientSecret, paymentIntentId: b.paymentIntentId });
      })
      .catch(() => undefined);
  });
  return starts;
}

/** The demo saree into the bag from its page (one option, so Add to bag adds at once). */
export async function addDemoToBag(page: Page): Promise<void> {
  await page.goto(`/states/${DEMO_PRODUCT.region}/${DEMO_PRODUCT.slug}`);
  await page.getByRole('button', { name: 'Add to bag' }).first().click();
  await expect(page.getByRole('link', { name: 'View bag' })).toBeVisible();
}

/** /checkout: phone, then delivery; stops on "Continue to payment" without pressing it. */
export async function fillCheckoutDetails(page: Page): Promise<void> {
  await page.goto('/checkout');
  await page.locator('input[name="phone"]').fill('(732) 555-0142');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('input[name="fullName"]').fill('E2E Customer');
  await page.locator('input[name="email"]').fill(E2E_CUSTOMER.email);
  await page.locator('input[name="zipCode"]').fill('08817');
  await expect(page.getByText('✓ Edison, NJ')).toBeVisible();
  await page.locator('input[name="line1"]').fill('1 Test Street');
}

export const continueToPayment = (page: Page): Locator => page.getByRole('button', { name: 'Continue to payment' });

/** The demo saree in the bag, the details typed, Continue to payment pressed: the priced summary and the card form. */
export async function reachPayment(page: Page): Promise<void> {
  await addDemoToBag(page);
  await fillCheckoutDetails(page);
  await continueToPayment(page).click();
  // the priced step: its shipping choice (the bag's 'Estimated delivery' is folded behind the bag bar on phones)
  await expect(page.getByRole('radio', { name: /^Standard/ })).toBeVisible();
}

/** Stripe's Payment Element: the visible frame inside <main> (Stripe's dev-tools frame sits outside it). */
export const cardFrame = (page: Page) =>
  page.getByRole('main').locator('iframe:not([aria-hidden="true"])').first().contentFrame();

/** Types a test card into the Payment Element (opening "Card" first when the methods are listed collapsed). */
export async function fillCard(page: Page, number: string): Promise<void> {
  const card = cardFrame(page);
  const field = card.locator('[name="number"]');
  const cardTab = card.getByRole('button', { name: 'Card', exact: true });
  await expect(field.or(cardTab).first()).toBeVisible({ timeout: 30_000 });
  if (!(await field.isVisible())) await cardTab.click();
  await field.fill(number);
  await card.locator('[name="expiry"]').fill('12 / 34');
  await card.locator('[name="cvc"]').fill('123');
  const postal = card.locator('[name="postalCode"]');
  if (await postal.isVisible().catch(() => false)) await postal.fill('08817');
}

export const payButton = (page: Page): Locator => page.getByRole('button', { name: /^Pay \$/ });

/** Card in, Pay pressed (clickPay keeps the button clear of Stripe's test-mode badge). */
export async function payWith(page: Page, number: string): Promise<void> {
  await fillCard(page, number);
  await clickPay(page);
}

/**
 * Stripe's test 3-D Secure challenge: a frame (inside Stripe's own frames) with Complete and Fail buttons. Found by
 * looking through every frame, since its nesting changes between Stripe versions.
 */
export async function answerThreeDS(page: Page, answer: 'complete' | 'fail'): Promise<void> {
  const id = answer === 'complete' ? '#test-source-authorize-3ds' : '#test-source-fail-3ds';
  const name = answer === 'complete' ? /^complete/i : /^fail/i;
  // Clicked until the challenge closes: a button can show before Stripe's test page listens to it, and a click then
  // does nothing (seen in long runs).
  await expect(async () => {
    let button: Locator | undefined;
    for (const frame of page.frames()) {
      if (frame === page.mainFrame()) continue;
      const candidate = frame.locator(id).or(frame.getByRole('button', { name })).first();
      if (await candidate.isVisible().catch(() => false)) {
        button = candidate;
        break;
      }
    }
    expect(button, 'the 3-D Secure challenge never showed').toBeDefined();
    await button!.click({ timeout: 5_000 });
    await expect(button!).toBeHidden({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

/** Lines in this tab's bag (the bag lives in localStorage, features/cart/store.ts). */
export const bagLineCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    try {
      return (JSON.parse(localStorage.getItem('iwc-cart') ?? '{}') as { state?: { lines?: unknown[] } }).state?.lines?.length ?? 0;
    } catch {
      return 0;
    }
  });

/** The orders the server created for one PaymentIntent (0 or 1 is all a payment may ever make). */
export async function ordersFor(paymentIntentId: string): Promise<{ order_number: string; total_cents: number }[]> {
  const { data, error } = await serviceClient()
    .from('orders')
    .select('order_number, total_cents')
    .eq('payment_intent_id', paymentIntentId);
  if (error) throw error;
  return data;
}

/** The order confirmation email waiting in the outbox for an order (emails stay there during tests). */
export async function confirmationQueued(orderNumber: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from('email_outbox')
    .select('id')
    .eq('kind', 'order_confirmation')
    .contains('payload', { orderNumber });
  if (error) throw error;
  return data.length > 0;
}

/** A read from Stripe's test API with the server's test key (env.ts has already refused a live one). */
export async function stripeGet<T>(path: string): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY ?? '';
  if (!key.startsWith('sk_test_')) throw new Error('stripeGet needs a Stripe test key');
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

/** A PaymentIntent's status and how much of its charge was refunded. */
export async function intentRefund(paymentIntentId: string): Promise<{ status: string; amount: number; refunded: number }> {
  const pi = await stripeGet<{ status: string; amount: number; latest_charge: { amount_refunded: number } | null }>(
    `payment_intents/${paymentIntentId}?expand[]=latest_charge`,
  );
  return { status: pi.status, amount: pi.amount, refunded: pi.latest_charge?.amount_refunded ?? 0 };
}
