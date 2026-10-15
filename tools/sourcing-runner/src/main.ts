import { PRODUCT_TYPES } from '@repo/shared/domain';

import { Lanes, openBrowser, profileFor } from './browser';
import { runChecks } from './check';
import { sortNewClothing } from './classes';
import { DEFAULT_SHOPS, type RunContext } from './context';
import { Db } from './db';
import { loadEnv } from './env';
import { findForTarget } from './find';
import { errorText, log, setLogTag, ShopStats } from './log';
import { describeNetError, resolveOverHttps } from './net';
import { fillWeights } from './weights';

import type { ProductType } from '@repo/shared/domain';
import type { SourcingPlan } from '@repo/shared/sourcing/auto';

/**
 * The sourcing runner (D-118). On a PC in India:
 *   pnpm sourcing setup                  open every shop once to set the hub's delivery address (kept in the profile)
 *   pnpm sourcing run                    the weekly checks that are due, then the queued targets
 *   pnpm sourcing run --checks           only the checks      (--targets: only the targets)
 *   pnpm sourcing run --type clothing --shops nishorama.com    one product type (and shop) only, so two runners
 *                                        can run at once in two terminals, each with its own browser profile
 *   pnpm sourcing run --weights          only clothing by class (D-132) and the weights listings lack (D-129; `run`
 *                                        ends with them too)
 *   pnpm sourcing classes                only clothing by class (D-132): no browser, no shops, no new listings
 *   pnpm sourcing try "kasuri methi" --type food    a dry run: what it would add, nothing written
 *   pnpm sourcing doctor                 tests the road to Supabase and the worker sign-in
 * Windows Task Scheduler runs `run` once a day (README.md).
 */

const SETUP_PAGES = [
  'https://blinkit.com/',
  'https://www.zepto.com/',
  'https://www.swiggy.com/instamart',
  'https://www.bigbasket.com/',
  'https://www.amazon.in/',
  'https://www.flipkart.com/',
  'https://www.myntra.com/',
];

async function setup(): Promise<void> {
  const env = loadEnv(false);
  const context = await openBrowser(env, { headless: false, images: true });
  for (const url of SETUP_PAGES) await (await context.newPage()).goto(url).catch(() => undefined);
  log(
    'Set the hub address (or its pincode) on each tab, then close the browser. The profile keeps it.',
  );
  await new Promise<void>((resolve) => context.on('close', () => resolve()));
}

/** What stands between this PC and IWC's database: DNS, public DNS, HTTPS, the worker sign-in. */
async function doctor(): Promise<number> {
  const env = loadEnv(true);
  const host = new URL(env.IWC_SUPABASE_URL).hostname;
  const { lookup } = await import('node:dns/promises');
  const step = async (name: string, work: () => Promise<string>): Promise<boolean> => {
    try {
      log(`ok    ${name}: ${await work()}`);
      return true;
    } catch (error) {
      log(`FAIL  ${name}: ${describeNetError(error)}`);
      return false;
    }
  };
  await step("this network's DNS", async () =>
    (await lookup(host, { all: true })).map((a) => a.address).join(', '),
  );
  await step('public DNS (Cloudflare/Google)', async () =>
    (await resolveOverHttps(host)).join(', '),
  );
  await step('Supabase over HTTPS', async () => {
    const res = await fetch(`${env.IWC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.IWC_SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    return `HTTP ${res.status}`;
  });
  const signedIn = await step('worker sign-in (with public DNS if needed)', async () => {
    await Db.signIn(env);
    return 'signed in as the worker';
  });
  return signedIn ? 0 : 1;
}

const flag = (args: string[], name: string): string | null =>
  args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null;

async function run(args: string[]): Promise<number> {
  const env = loadEnv(true);
  const started = new Date();
  const type = (PRODUCT_TYPES as readonly string[]).includes(flag(args, '--type') ?? '')
    ? (flag(args, '--type') as ProductType)
    : null;
  if (args.includes('--type') && !type)
    throw new Error(`--type is one of ${PRODUCT_TYPES.join(', ')}`);
  const site =
    flag(args, '--shops')
      ?.replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/.*$/, '') ?? null;
  if (site && !type)
    throw new Error('--shops needs --type (for example: --type clothing --shops nishorama.com)');
  setLogTag([type, site].filter(Boolean).join(' '));
  const db = await Db.signIn(env);
  const weightsOnly = args.includes('--weights');
  const plan = await db.plan(args.includes('--targets') || weightsOnly ? 0 : 400, { type, site });
  const targets = args.includes('--checks') || weightsOnly ? [] : plan.targets;
  log(
    `run: ${plan.checks.length} checks due, ${targets.length} targets, ${plan.shops.length} shops`,
  );
  const context = await openBrowser(env, {
    headless: env.IWC_SOURCING_HEADLESS === '1',
    images: false,
    profile: profileFor(env, type),
  });
  const ctx: RunContext = {
    db,
    plan,
    lanes: new Lanes(context),
    stats: new ShopStats(),
    known: new Set(plan.known),
    now: started,
  };
  let added = 0;
  let errors = 0;
  try {
    const checks =
      plan.checks.length && !weightsOnly
        ? await runChecks(ctx)
        : { products: 0, prices: 0, stock: 0, held: 0, errors: 0 };
    errors += checks.errors;
    // three targets at a time: each already spreads over every shop
    for (let i = 0; i < targets.length; i += 3) {
      const batch = await Promise.all(
        targets.slice(i, i + 3).map((t) =>
          findForTarget(ctx, t).catch((error) => {
            errors += 1;
            log(`target "${t.name}" failed: ${errorText(error)}`);
            return 0;
          }),
        ),
      );
      added += batch.reduce((a, b) => a + b, 0);
    }
    // D-132: new clothing by class first (its weight is then settled); D-129: the weights the rest lack
    const onlyOne = args.includes('--checks') || args.includes('--targets');
    const classed = onlyOne || (type && type !== 'clothing') ? 0 : await sortNewClothing(db);
    const weights = onlyOne ? 0 : await fillWeights(ctx, 40, type);
    await db.logRun({
      started_at: started.toISOString(),
      targets_searched: targets.length,
      listings_added: added,
      products_checked: checks.products,
      prices_changed: checks.prices,
      stock_changed: checks.stock,
      held: checks.held,
      errors,
      shops: ctx.stats.toJSON(),
    });
    log(
      `done: ${checks.products} checked (${checks.prices} prices, ${checks.stock} stock, ${checks.held} held), ${added} listings added, ${classed} clothing options weighed by class, ${weights} weights found`,
    );
  } finally {
    await context.close();
  }
  return errors ? 1 : 0;
}

async function dryRun(args: string[]): Promise<void> {
  const flagValues = new Set(args.flatMap((a, i) => (a.startsWith('--') ? [i + 1] : [])));
  const query = args.find((a, i) => !a.startsWith('--') && !flagValues.has(i)) ?? '';
  const flag = (name: string): string | null =>
    args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null;
  const match = flag('--match');
  const rupees = (name: string): number | null =>
    flag(name) ? Math.round(Number(flag(name)) * 100) || null : null;
  const type = PRODUCT_TYPES.find((t) => args.includes(t)) ?? 'food';
  if (query.length < 2)
    throw new Error(
      'Usage: pnpm sourcing try "<what to find>" --type food|clothing|home [--match words] [--shops myntra.com] [--min 600] [--max 1600] [--listings 3]',
    );
  const env = loadEnv(false);
  const plan: SourcingPlan = {
    settings: {
      max_delivery_days: 3,
      listings_per_target: 3,
      check_every_days: 7,
      qty_per_variant: 5,
      targets_per_run: 1,
      max_rise_pct: 60,
      max_drop_pct: 50,
      auto_publish: false,
    },
    shops: DEFAULT_SHOPS,
    targets: [],
    checks: [],
    known: [],
  };
  const context = await openBrowser(env, {
    headless: env.IWC_SOURCING_HEADLESS === '1',
    images: false,
  });
  const ctx: RunContext = {
    db: null,
    plan,
    lanes: new Lanes(context),
    stats: new ShopStats(),
    known: new Set(),
    now: new Date(),
  };
  try {
    await findForTarget(ctx, {
      id: '00000000-0000-4000-8000-000000000000',
      name: query,
      query,
      must_match: match,
      product_type: type,
      category: 'dry-run',
      region: null,
      tier: null,
      sites: flag('--shops')?.split(',').filter(Boolean) ?? null,
      min_price_paise: rupees('--min'),
      max_price_paise: rupees('--max'),
      listings: Number(flag('--listings')) || null,
    });
    log(`shops: ${JSON.stringify(ctx.stats.toJSON())}`);
  } finally {
    await context.close();
  }
}

/** D-132: every clothing listing not yet sorted takes its class weight; nothing else runs. */
async function classes(): Promise<number> {
  const written = await sortNewClothing(await Db.signIn(loadEnv(true)));
  log(`done: ${written} clothing options weighed by class`);
  return 0;
}

const [command, ...args] = process.argv.slice(2);
const main =
  command === 'classes'
    ? classes()
    : command === 'setup'
      ? setup()
      : command === 'run'
        ? run(args)
        : command === 'try'
          ? dryRun(args)
          : command === 'doctor'
            ? doctor()
            : null;
if (!main) {
  console.log(
    'Usage: pnpm sourcing setup | doctor | classes | run [--checks|--targets] [--type clothing|food|home [--shops nishorama.com]] | try "<query>" --type food|clothing|home [--match "regex"]',
  );
  process.exit(2);
}
main.then(
  (code) => process.exit(typeof code === 'number' ? code : 0),
  (error) => {
    log(`stopped: ${errorText(error)}`);
    process.exit(1);
  },
);
