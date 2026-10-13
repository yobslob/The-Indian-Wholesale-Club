import { PRODUCT_TYPES } from '@repo/shared/domain';

import { Lanes, openBrowser } from './browser';
import { runChecks } from './check';
import { DEFAULT_SHOPS, type RunContext } from './context';
import { Db } from './db';
import { loadEnv } from './env';
import { findForTarget } from './find';
import { errorText, log, ShopStats } from './log';

import type { SourcingPlan } from '@repo/shared/sourcing/auto';

/**
 * The sourcing runner (D-118). On a PC in India:
 *   pnpm sourcing setup                  open every shop once to set the hub's delivery address (kept in the profile)
 *   pnpm sourcing run                    the weekly checks that are due, then the queued targets
 *   pnpm sourcing run --checks           only the checks      (--targets: only the targets)
 *   pnpm sourcing try "kasuri methi" --type food    a dry run: what it would add, nothing written
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

async function run(args: string[]): Promise<number> {
  const env = loadEnv(true);
  const started = new Date();
  const db = await Db.signIn(env);
  const plan = await db.plan(args.includes('--targets') ? 0 : 400);
  const targets = args.includes('--checks') ? [] : plan.targets;
  log(
    `run: ${plan.checks.length} checks due, ${targets.length} targets, ${plan.shops.length} shops`,
  );
  const context = await openBrowser(env, {
    headless: env.IWC_SOURCING_HEADLESS === '1',
    images: false,
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
    const checks = plan.checks.length
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
      `done: ${checks.products} checked (${checks.prices} prices, ${checks.stock} stock, ${checks.held} held), ${added} listings added`,
    );
  } finally {
    await context.close();
  }
  return errors ? 1 : 0;
}

async function dryRun(args: string[]): Promise<void> {
  const flagValues = new Set(args.flatMap((a, i) => (a.startsWith('--') ? [i + 1] : [])));
  const query = args.find((a, i) => !a.startsWith('--') && !flagValues.has(i)) ?? '';
  const match = args.includes('--match') ? (args[args.indexOf('--match') + 1] ?? null) : null;
  const type = PRODUCT_TYPES.find((t) => args.includes(t)) ?? 'food';
  if (query.length < 2)
    throw new Error('Usage: pnpm sourcing try "<what to find>" --type food|clothing|home');
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
      region: 'dry-run',
      tier: null,
    });
    log(`shops: ${JSON.stringify(ctx.stats.toJSON())}`);
  } finally {
    await context.close();
  }
}

const [command, ...args] = process.argv.slice(2);
const main =
  command === 'setup'
    ? setup()
    : command === 'run'
      ? run(args)
      : command === 'try'
        ? dryRun(args)
        : null;
if (!main) {
  console.log(
    'Usage: pnpm sourcing setup | run [--checks|--targets] | try "<query>" --type food|clothing|home [--match "regex"]',
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
