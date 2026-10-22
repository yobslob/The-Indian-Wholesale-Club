import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  isRobotCheck,
  mayClearByItself,
  nextRest,
  restingUntil,
  STRIKES_TO_REST,
  type ShopRest,
  type ShownPage,
} from '@repo/shared/sourcing/auto';

import { ROOT } from './env';
import { log } from './log';
import { readRests, restShop } from './rest';

import type { BrowserContext, Page, Response } from 'playwright';

/**
 * Each shop is a lane: its pages load one after another with a pause between them, while different shops run side
 * by side. This keeps every shop at a person's pace and the whole run fast. A shop that answers with robot checks
 * rests (D-149).
 */

const GAP_MS = 2500;
const JITTER_MS = 1500;
const TIMEOUT_MS = 35_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits after "429 Too Many Requests" (or 503) when the shop names none: 10 s, then 30 s, then 60 s. */
const BACKOFF_MS = [10_000, 30_000, 60_000];

const clock = (d: Date): string => d.toTimeString().slice(0, 5);

/** D-149: the shop answered with a robot check, after Cloudflare's own check had its time to clear. */
export class RobotCheck extends Error {
  constructor(readonly site: string) {
    super('the shop showed a robot check');
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

export class Lane {
  private chain: Promise<unknown> = Promise.resolve();
  private page: Page | null = null;
  private last = 0;
  /** Grows after a shop says "too many requests" or shows a robot check, for the rest of the run. */
  private gapMs = GAP_MS;
  /** Robot checks in a row (D-149). */
  private strikes = 0;

  constructor(
    readonly site: string,
    private readonly lanes: Lanes,
  ) {}

  /** A robot check on this shop during this run (a strike or a rest): a failed target waits for another run. */
  get troubled(): boolean {
    return this.strikes > 0 || this.lanes.restingUntil(this.site) !== null;
  }

  /**
   * Runs `work` after everything queued on this shop, with this shop's tab. A resting shop is not asked at all
   * (ShopResting); two robot checks in a row rest it (D-149).
   */
  run<T>(work: (page: Page) => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const resting = this.lanes.restingUntil(this.site);
      if (resting) throw new ShopResting(this.site, resting);
      const wait = this.last + this.gapMs + Math.random() * JITTER_MS - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        if (!this.page || this.page.isClosed()) this.page = await this.lanes.browser.newPage();
        const done = await work(this.page);
        this.strikes = 0;
        return done;
      } catch (error) {
        if (error instanceof RobotCheck) this.strike();
        throw error;
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  private strike(): void {
    this.strikes += 1;
    this.gapMs = Math.min(this.gapMs * 2, 20_000);
    if (this.strikes >= STRIKES_TO_REST) this.lanes.rest(this.site, this.strikes);
  }

  /**
   * The shop's JSON (Shopify's catalogue), opened in the shop's tab. "Too many requests" (429, or
   * 503) is waited out (the shop's Retry-After, else 10, 30, 60 s) and the shop is read more slowly from then on.
   */
  async json(url: string): Promise<unknown> {
    return this.run(async (page) => {
      for (let attempt = 0; ; attempt += 1) {
        // opened in the shop's tab, through the browser itself: Shopify answered Node's own requests (the API
        // request context) with 429 after the first, while the browser and other clients got 200 (2026-10-16)
        const res = await page.goto(url, { timeout: TIMEOUT_MS, waitUntil: 'domcontentloaded' });
        if (!res) throw new Error(`no answer for ${new URL(url).pathname}`);
        if (res.ok()) return res.json();
        const busy = res.status() === 429 || res.status() === 503;
        if (!busy || attempt >= BACKOFF_MS.length)
          throw new Error(`${res.status()} for ${new URL(url).pathname}`);
        const asked = Number(res.headers()['retry-after']);
        const wait = asked > 0 && asked <= 300 ? asked * 1000 : BACKOFF_MS[attempt]!;
        this.gapMs = Math.min(this.gapMs * 2, 20_000);
        log(
          `  ${this.site}: too many requests (${res.status()}), waiting ${Math.round(wait / 1000)} s`,
        );
        await sleep(wait);
      }
    });
  }
}

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
    const site = new URL(url).hostname.replace(/^www\./, '');
    await keepEvidence(page, site, url, shown);
    throw new RobotCheck(site);
  }
  if (!cleared && res && res.status() >= 400 && shown.shown.trim().length < 200)
    throw new Error(`the shop answered ${res.status()}`);
}

/**
 * Every shop's lane, and which shops rest (D-149): this PC's shop-rest.json, read again at most once a minute so a
 * rest the other runner starts reaches this one. `remember: false` (a dry run) rests a shop for this run only.
 */
export class Lanes {
  private readonly lanes = new Map<string, Lane>();
  private rests: Record<string, ShopRest> = {};
  private readAt = 0;

  constructor(
    private readonly context: BrowserContext,
    private readonly remember = true,
  ) {}

  of(site: string): Lane {
    let lane = this.lanes.get(site);
    if (!lane) {
      lane = new Lane(site, this);
      this.lanes.set(site, lane);
    }
    return lane;
  }

  get browser(): BrowserContext {
    return this.context;
  }

  restingUntil(site: string): Date | null {
    if (this.remember && Date.now() - this.readAt > 60_000) {
      // the later rest of each shop wins: this runner's own, or one the other runner started since
      for (const rest of Object.values(readRests()))
        if (!this.rests[rest.site] || rest.since > this.rests[rest.site]!.since)
          this.rests[rest.site] = rest;
      this.readAt = Date.now();
    }
    return restingUntil(this.rests[site], new Date());
  }

  /** The shops resting now, for the run's first line. */
  resting(sites: string[]): string[] {
    return sites.flatMap((site) => {
      const until = this.restingUntil(site);
      return until ? [`${site} until ${clock(until)}`] : [];
    });
  }

  rest(site: string, strikes: number): void {
    if (this.restingUntil(site)) return;
    const rest = this.remember ? restShop(site) : nextRest(site, this.rests[site], new Date());
    this.rests[site] = rest;
    const hours = Math.round((Date.parse(rest.until) - Date.parse(rest.since)) / 3600_000);
    log(
      `  ${site}: ${strikes} robot checks in a row; left alone until ${clock(new Date(rest.until))} (${hours} h). ` +
        'Its targets go back to the queue and its listings are checked on a later run.',
    );
  }
}
