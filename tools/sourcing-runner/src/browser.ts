import { chromium, type BrowserContext, type Page } from 'playwright';

import type { Env } from './env';

/**
 * One browser with the hub's addresses (a persistent profile, set once with `setup`), one tab per shop. Each shop is
 * a lane: its pages load one after another with a pause between them, while different shops run side by side. This
 * keeps every shop at a person's pace and the whole run fast.
 */

const GAP_MS = 2500;
const JITTER_MS = 1500;
const TIMEOUT_MS = 35_000;

export async function openBrowser(
  env: Env,
  opts: { headless: boolean; images: boolean },
): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(env.IWC_SOURCING_PROFILE, {
    channel: env.IWC_SOURCING_CHANNEL === 'chromium' ? undefined : env.IWC_SOURCING_CHANNEL,
    headless: opts.headless,
    viewport: { width: 1366, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    // the browser a person uses: no "controlled by automated software" flag for shops to refuse
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      ...(opts.headless ? [] : ['--window-position=-2400,0']),
    ],
  });
  // The page readers are sent to the page as source; tsx names functions with a `__name` helper the page lacks.
  await context.addInitScript({ content: 'globalThis.__name = globalThis.__name || ((f) => f);' });
  if (opts.headless) {
    // headless Chrome says "HeadlessChrome" in its user agent, which some shops (Zepto) answer with an error
    const probe = await context.newPage();
    const agent = (await probe.evaluate('navigator.userAgent')) as string;
    await probe.close();
    if (/Headless/.test(agent)) {
      const real = agent.replace('HeadlessChrome', 'Chrome');
      context.on('page', (page) => {
        void context
          .newCDPSession(page)
          .then((cdp) => cdp.send('Network.setUserAgentOverride', { userAgent: real }))
          .catch(() => undefined);
      });
    }
  }
  if (!opts.images) {
    // pages read faster without photos, fonts and video; photos are fetched on their own when a listing is made
    await context.route('**/*', (route) =>
      ['image', 'media', 'font'].includes(route.request().resourceType())
        ? route.abort()
        : route.continue(),
    );
  }
  return context;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Lane {
  private chain: Promise<unknown> = Promise.resolve();
  private page: Page | null = null;
  private last = 0;

  constructor(
    readonly site: string,
    private readonly context: BrowserContext,
  ) {}

  /** Runs `work` after everything queued on this shop, with this shop's tab. */
  run<T>(work: (page: Page) => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const wait = this.last + GAP_MS + Math.random() * JITTER_MS - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        if (!this.page || this.page.isClosed()) this.page = await this.context.newPage();
        return await work(this.page);
      } finally {
        this.last = Date.now();
      }
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  /** The shop's JSON (Shopify's catalogue) with this browser's cookies, without a page. */
  async json(url: string): Promise<unknown> {
    return this.run(async () => {
      const res = await this.context.request.get(url, {
        timeout: TIMEOUT_MS,
        headers: { accept: 'application/json' },
      });
      if (!res.ok()) throw new Error(`${res.status()} for ${new URL(url).pathname}`);
      return res.json();
    });
  }
}

const ROBOT_CHECK =
  /captcha|robot check|are you a robot|not a robot|verify you are (a )?human|access denied|request blocked|pardon our interruption|unusual traffic/i;

/**
 * Opens a page and fails clearly when the shop shows a robot check instead. It looks at what the page shows, not
 * its source: a normal shop page often loads a captcha script it never shows.
 */
export async function open(page: Page, url: string, waitFor?: string): Promise<void> {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15_000 }).catch(() => undefined);
  else await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => undefined);
  const shown = (await page.evaluate(
    "document.title + ' ' + (document.body ? document.body.innerText : '').slice(0, 4000)",
  )) as string;
  if (ROBOT_CHECK.test(shown) && shown.length < 3000)
    throw new Error('the shop showed a robot check');
  if (res && res.status() >= 400 && shown.trim().length < 200)
    throw new Error(`the shop answered ${res.status()}`);
}

export class Lanes {
  private readonly lanes = new Map<string, Lane>();
  constructor(private readonly context: BrowserContext) {}
  of(site: string): Lane {
    let lane = this.lanes.get(site);
    if (!lane) {
      lane = new Lane(site, this.context);
      this.lanes.set(site, lane);
    }
    return lane;
  }
  get browser(): BrowserContext {
    return this.context;
  }
}
