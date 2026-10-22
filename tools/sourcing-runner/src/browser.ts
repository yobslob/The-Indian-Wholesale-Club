import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium, type BrowserContext } from 'playwright';

import type { Env } from './env';

/**
 * One browser with the hub's addresses (a persistent profile, set once with `setup`), one tab per shop (its lane,
 * lanes.ts).
 */

/**
 * Two runners cannot share one Chrome profile (the second finds it locked), so a runner for one product type uses
 * its own: the main profile copied once (it keeps the hub's addresses), without Chrome's lock files. A file the other
 * runner's Chrome holds open (its cookies) is skipped, not fatal: Chrome makes a new one.
 */
export function profileFor(env: Env, name: string | null): string {
  if (!name) return env.IWC_SOURCING_PROFILE;
  const dir = `${env.IWC_SOURCING_PROFILE}-${name}`;
  if (!existsSync(dir) && existsSync(env.IWC_SOURCING_PROFILE))
    copyProfile(env.IWC_SOURCING_PROFILE, dir);
  return dir;
}

/** Chrome's caches: most of a profile's size, and rebuilt as it browses. */
const CACHES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'GrShaderCache',
  'ShaderCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Service Worker',
  'component_crx_cache',
  'extensions_crx_cache',
]);

function copyProfile(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (/Singleton|lockfile|\.lock$/i.test(entry.name) || CACHES.has(entry.name)) continue;
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyProfile(src, dst);
    else {
      try {
        copyFileSync(src, dst);
      } catch {
        // held open by the running browser
      }
    }
  }
}

export async function openBrowser(
  env: Env,
  opts: { headless: boolean; images: boolean; profile?: string },
): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext(opts.profile ?? env.IWC_SOURCING_PROFILE, {
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
