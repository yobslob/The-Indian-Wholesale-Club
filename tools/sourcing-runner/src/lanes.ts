import {
  nextRest,
  PAGES_PER_HOUR,
  paceWaitMs,
  restingUntil,
  STRIKES_TO_REST,
  type ShopRest,
} from '@repo/shared/sourcing/auto';

import { log } from './log';
import { PaceBook, readRests, restShop } from './rest';
import { clock, RobotCheck, ShopResting, TIMEOUT_MS } from './robot';

import type { BrowserContext, Page } from 'playwright';

export { isBlocked, open, RobotCheck, ShopResting } from './robot';

/**
 * Each shop is a lane: its pages load one after another with a pause between them, while different shops run side
 * by side. This keeps every shop at a person's pace and the whole run fast. A quick-commerce shop also gets no more
 * pages an hour than it took without trouble (D-153), and a shop that answers with robot checks rests (D-149).
 */

const GAP_MS = 2500;
const JITTER_MS = 1500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits after "429 Too Many Requests" (or 503) when the shop names none: 10 s, then 30 s, then 60 s. */
const BACKOFF_MS = [10_000, 30_000, 60_000];

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
      await this.lanes.pace(this.site);
      const wait = this.last + this.gapMs + Math.random() * JITTER_MS - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        if (!this.page || this.page.isClosed()) this.page = await this.lanes.browser.newPage();
        const done = await work(this.page);
        this.strikes = 0;
        return done;
      } catch (error) {
        if (error instanceof RobotCheck) this.strike(error);
        throw error;
      } finally {
        this.last = Date.now();
        this.lanes.asked(this.site);
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  private strike(check: RobotCheck): void {
    this.strikes += 1;
    this.gapMs = Math.min(this.gapMs * 2, 20_000);
    // a shop that says how long to wait is believed at once (D-153)
    if (this.strikes >= STRIKES_TO_REST || check.retryAfterMs !== null)
      this.lanes.rest(this.site, this.strikes, check.retryAfterMs);
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

/**
 * Every shop's lane, and which shops rest (D-149): this PC's shop-rest.json, read again at most once a minute so a
 * rest the other runner starts reaches this one. `remember: false` (a dry run) rests a shop for this run only.
 */
export class Lanes {
  private readonly lanes = new Map<string, Lane>();
  private rests: Record<string, ShopRest> = {};
  private readAt = 0;
  private readonly book = new PaceBook();

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

  rest(site: string, strikes: number, atLeastMs: number | null = null): void {
    if (this.restingUntil(site)) return;
    const rest = this.remember
      ? restShop(site, atLeastMs)
      : nextRest(site, this.rests[site], new Date(), atLeastMs);
    this.rests[site] = rest;
    const hours = Math.round((Date.parse(rest.until) - Date.parse(rest.since)) / 3600_000);
    const why = atLeastMs !== null ? 'said too many requests' : `${strikes} robot checks in a row`;
    log(
      `  ${site}: ${why}; left alone until ${clock(new Date(rest.until))} (${hours} h). ` +
        'Its targets go back to the queue and its listings are checked on a later run.',
    );
  }

  /** D-153: waits while the shop had its hourly pages (both runners together). */
  async pace(site: string): Promise<void> {
    const wait = paceWaitMs(this.book.pages(site), Date.now(), PAGES_PER_HOUR[site]);
    if (wait <= 0) return;
    log(
      `  ${site}: ${PAGES_PER_HOUR[site]} pages in the last hour; the next in ${Math.ceil(wait / 60_000)} min (D-153)`,
    );
    await sleep(wait);
  }

  asked(site: string): void {
    if (PAGES_PER_HOUR[site]) this.book.asked(site);
  }
}
