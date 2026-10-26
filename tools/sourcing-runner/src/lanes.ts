import { log } from './log';
import { RobotCheck, TIMEOUT_MS } from './robot';

import type { BrowserContext, Page } from 'playwright';

export { isBlocked, open, RobotCheck } from './robot';

/**
 * Each shop is a lane: its pages load one after another with a short pause between them, while different shops run
 * side by side. D-158 (founder 2026-10-24): no hourly limit and no rest after robot checks: a page a shop refuses
 * fails on its own and the run goes on (D-149's rests and D-153's pace are gone).
 */

const GAP_MS = 2500;
const JITTER_MS = 1500;

/** A shop's tab is closed and opened again after this many pages: what a tab gathers is let go (memory.ts). */
const PAGES_PER_TAB = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits after "429 Too Many Requests" (or 503) when the shop names none: 10 s, then 30 s, then 60 s. */
const BACKOFF_MS = [10_000, 30_000, 60_000];

export class Lane {
  private chain: Promise<unknown> = Promise.resolve();
  private page: Page | null = null;
  private last = 0;
  private pages = 0;
  /** Grows after a shop's catalogue says "too many requests", for the rest of the run. */
  private gapMs = GAP_MS;
  /** Robot checks on this shop during this run. */
  private refusals = 0;

  constructor(
    readonly site: string,
    private readonly lanes: Lanes,
  ) {}

  /** A robot check on this shop during this run: a target it left empty is searched again on a later run. */
  get troubled(): boolean {
    return this.refusals > 0;
  }

  /** Runs `work` after everything queued on this shop, with this shop's tab. */
  run<T>(work: (page: Page) => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const wait = this.last + this.gapMs + Math.random() * JITTER_MS - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        if (this.page && !this.page.isClosed() && this.pages >= PAGES_PER_TAB)
          await this.page.close().catch(() => undefined);
        if (!this.page || this.page.isClosed()) {
          this.page = await this.lanes.browser.newPage();
          this.pages = 0;
        }
        this.pages += 1;
        return await work(this.page);
      } catch (error) {
        if (error instanceof RobotCheck) this.refusals += 1;
        throw error;
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
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

/** Every shop's lane. */
export class Lanes {
  private readonly lanes = new Map<string, Lane>();

  constructor(private readonly context: BrowserContext) {}

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
}
