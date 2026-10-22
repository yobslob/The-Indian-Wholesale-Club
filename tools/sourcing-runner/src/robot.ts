import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isRobotCheck,
  mayClearByItself,
  retryAfterMs,
  type ShownPage,
} from '@repo/shared/sourcing/auto';

import { ROOT } from './env';

import type { Page, Response } from 'playwright';

/**
 * Opening a shop page and knowing a refusal when one comes (D-149, D-153): a robot check, a block page or "too many
 * requests", told apart from a page that only failed to load.
 */

export const TIMEOUT_MS = 35_000;

/** "14:05", or "Fri 14:05" when it is not today (a shop's own wait can be 20 hours, D-153). */
export const clock = (d: Date): string =>
  `${d.toDateString() === new Date().toDateString() ? '' : `${d.toDateString().slice(0, 3)} `}${d.toTimeString().slice(0, 5)}`;

/**
 * D-149: the shop answered with a robot check, after Cloudflare's own check had its time to clear, or with "too many
 * requests" (429). `retryAfterMs`: how long the shop itself asked to be left alone (D-153).
 */
export class RobotCheck extends Error {
  constructor(
    readonly site: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(
      retryAfterMs === null ? 'the shop showed a robot check' : 'the shop said too many requests',
    );
  }
}

/** D-149: the shop is resting after robot checks; nothing was asked of it. */
export class ShopResting extends Error {
  constructor(
    readonly site: string,
    readonly until: Date,
  ) {
    super(`resting until ${clock(until)} after robot checks`);
  }
}

/** A shop refused the runner (now or earlier in its rest): says nothing about the piece, so nothing is changed. */
export const isBlocked = (error: unknown): boolean =>
  error instanceof RobotCheck || error instanceof ShopResting;

/** How long Cloudflare's own check ("Just a moment…") may take to clear by itself before it counts as a block. */
const CLEAR_WAIT_MS = 20_000;

async function shownOn(page: Page, res: Response | null): Promise<ShownPage> {
  return {
    status: res?.status() ?? null,
    headers: res?.headers() ?? {},
    shown: (await page.evaluate(
      "document.title + ' ' + (document.body ? document.body.innerText : '').slice(0, 4000)",
    )) as string,
  };
}

/** The first block of each shop in a run, as the shop showed it (out/blocks/), to see what it was. */
const kept = new Set<string>();
async function keepEvidence(
  page: Page,
  site: string,
  url: string,
  shown: ShownPage,
): Promise<void> {
  if (kept.has(site)) return;
  kept.add(site);
  const dir = join(ROOT, 'out', 'blocks');
  const name = `${site}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `${name}.txt`),
      `${url}\n${shown.status ?? ''} ${JSON.stringify(shown.headers)}\n\n${shown.shown}\n`,
    );
    await page.screenshot({ path: join(dir, `${name}.png`) });
  } catch {
    // evidence only
  }
}

/**
 * Opens a page and fails clearly (RobotCheck) when the shop shows a robot check instead. It looks at what the page
 * shows and Cloudflare's header, not the source: a normal shop page often loads a captcha script it never shows.
 * Cloudflare's own check runs in the page like in anyone's browser and often clears in a few seconds, so it gets
 * that time first (D-149).
 */
export async function open(page: Page, url: string, waitFor?: string): Promise<void> {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  const site = new URL(url).hostname.replace(/^www\./, '');
  if (res?.status() === 429) {
    // "too many requests" (Blinkit's said 73,954 s on 2026-10-22, D-153): a block with the shop's own wait
    const asked = await shownOn(page, res);
    await keepEvidence(page, site, url, asked);
    throw new RobotCheck(site, retryAfterMs(asked.headers, new Date()) ?? 0);
  }
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => undefined);
  else await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
  let shown = await shownOn(page, res);
  let cleared = false;
  if (isRobotCheck(shown) && mayClearByItself(shown)) {
    const until = Date.now() + CLEAR_WAIT_MS;
    while (Date.now() < until && isRobotCheck(shown)) {
      await page.waitForTimeout(1000);
      // the first answer's header no longer applies: the page itself says whether it cleared
      shown = await shownOn(page, null).catch(() => shown);
    }
    cleared = !isRobotCheck(shown);
    if (cleared) {
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => undefined);
      else await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
    }
  }
  if (isRobotCheck(shown)) {
    await keepEvidence(page, site, url, shown);
    throw new RobotCheck(site);
  }
  if (!cleared && res && res.status() >= 400 && shown.shown.trim().length < 200)
    throw new Error(`the shop answered ${res.status()}`);
}
