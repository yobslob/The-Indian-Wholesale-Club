import { PRODUCT_TYPES } from '@repo/shared/domain';

import { openBrowser, profileFor } from './browser';
import { runChecks } from './check';
import { sortNewClothing } from './classes';
import { DEFAULT_SHOPS, type RunContext } from './context';
import { Db } from './db';
import { loadEnv } from './env';
import { findForTarget } from './find';
import { weighFood } from './food';
import { weighHome } from './home';
import { Lanes } from './lanes';
import { checkLiquids } from './liquids';
import { errorText, log, setLogTag, ShopStats } from './log';
import { heapFull, heapText, isChild, keepRunning, RESTART_CODE } from './memory';
import { describeNetError, resolveOverHttps } from './net';
import { Redo } from './redo';
import { fillWeights } from './weights';

import type { ProductType } from '@repo/shared/domain';
import type { SourcingPlan } from '@repo/shared/sourcing/auto';

/**
 * The sourcing runner (D-118). On a PC in India:
 *   pnpm sourcing setup [--type food]    open every shop once to set the hub's delivery address (kept in the profile;
 *                                        --type: that runner's own profile, which a plain setup does not reach)
 *   pnpm sourcing run                    the weekly checks that are due, then the queued targets
 *   pnpm sourcing run --checks           only the checks      (--targets: only the targets)
 *   pnpm sourcing run --type clothing --shops nishorama.com    one product type (and shop) only, so two runners
 *                                        can run at once in two terminals, each with its own browser profile
 *   pnpm sourcing run --weights          only clothing by class (D-132) and the weights listings lack (D-129; `run`
 *                                        ends with them too)
 *   pnpm sourcing classes                only clothing by class (D-132): no browser, no shops, no new listings
 *   pnpm sourcing food [--all]           only food's packed weights (D-133): no browser, no shops, no new listings
 *   pnpm sourcing home [--dry] [--all]   only home weights from each option's own page (D-134; --dry: home-weights.csv)
 *   pnpm sourcing liquids [--dry]        only the liquid check (D-135): liquids archived, shown as coming soon
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

async function setup(args: string[]): Promise<void> {
  const env = loadEnv(false);
  const type = PRODUCT_TYPES.find((t) => t === flag(args, '--type')) ?? null;
  // a runner with --type browses with its own copy of the profile (profileFor): set up that one
  const context = await openBrowser(env, {
    images: true,
    profile: profileFor(env, type),
  });
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
  // D-149: claimed targets not yet searched go back to the queue when the run is stopped (Ctrl+C), instead of
  // waiting six hours as "being searched"
  const unsearched = new Set(targets.map((t) => t.id));
  let stopping = false;
  const stop = (): void => {
    if (stopping) process.exit(130);
    stopping = true;
    log(`stopping: ${unsearched.size} target${unsearched.size === 1 ? '' : 's'} back to the queue`);
    // the targets handed back so far first (flushReleases ends the holding), then the ones not reached
    void db
      .flushReleases()
      .then(() =>
        Promise.all(
          [...unsearched].map((id) => db.releaseTarget(id, 'the run was stopped; searched again next run')),
        ),
      )
      .finally(() => process.exit(130));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const context = await openBrowser(env, {
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
    // D-168: only a run that adds listings needs the photo redo service
    redo: targets.length ? await Redo.start(db) : null,
  };
  let added = 0;
  let errors = 0;
  let full = false;
  try {
    const checks =
      plan.checks.length && !weightsOnly
        ? await runChecks(ctx)
        : { products: 0, prices: 0, stock: 0, held: 0, errors: 0 };
    errors += checks.errors;
    // three targets at a time: each already spreads over every shop. A shop's collection ("collection:kurtis") goes
    // alone: its copies (kurtis 1 of 6, 2 of 6…) would otherwise race for the same first pieces.
    const lanes = (t: (typeof targets)[number]): string =>
      /^collection:/i.test(t.query.trim()) ? `collection ${t.query.trim().toLowerCase()}` : t.id;
    const searchAll = async (list: typeof targets): Promise<void> => {
      for (let i = 0; i < list.length && !stopping && !heapFull();) {
        const batch: typeof targets = [];
        while (i < list.length && batch.length < 3 && !batch.some((t) => lanes(t) === lanes(list[i]!)))
          batch.push(list[i++]!);
        const found = await Promise.all(
          batch.map((t) =>
            findForTarget(ctx, t)
              .catch(async (error) => {
                errors += 1;
                log(`target "${t.name}" failed: ${errorText(error)}`);
                await db.releaseTarget(t.id, `the search stopped: ${errorText(error)}`);
                return 0;
              })
              .finally(() => unsearched.delete(t.id)),
          ),
        );
        added += found.reduce((a, b) => a + b, 0);
      }
    };
    // D-158 (founder 2026-10-24: "I will just add the csv and run it one time"): one run takes every queued target,
    // claim after claim (Settings' targets per run is the size of each claim), until none is left. A target handed
    // back during the run waits until it ends (db.holdReleases), so the next claim does not take it again at once.
    db.holdReleases();
    const seen = new Set(targets.map((t) => t.id));
    let searched = targets.length;
    try {
      await searchAll(targets);
      while (targets.length && !stopping && !heapFull()) {
        const next = await db.plan(0, { type, site });
        for (const key of next.known) ctx.known.add(key);
        const fresh = next.targets.filter((t) => !seen.has(t.id));
        if (!fresh.length) break;
        for (const t of fresh) {
          seen.add(t.id);
          unsearched.add(t.id);
        }
        searched += fresh.length;
        log(`next claim: ${fresh.length} more targets (${searched} this run, ${heapText()})`);
        await searchAll(fresh);
      }
    } finally {
      await db.flushReleases();
    }
    // memory.ts: near Node's memory limit a fresh runner takes over; the targets not searched go back to the queue
    full = !stopping && heapFull();
    if (full) {
      log(`run: ${heapText()}: ${unsearched.size} targets back to the queue for a fresh runner`);
      await Promise.all(
        [...unsearched].map((id) => db.releaseTarget(id, 'handed to a fresh runner (memory)')),
      );
    }
    // D-132: new clothing by class first (its weight is then settled); D-129: the weights the rest lack; D-133: then
    // food's packed weights (also from the net quantities the page search found)
    const onlyOne = full || args.includes('--checks') || args.includes('--targets');
    const classed = onlyOne || (type && type !== 'clothing') ? 0 : await sortNewClothing(db);
    // D-134: home from each option's own page first (the D-129 search below then skips home)
    const home =
      onlyOne || (type && type !== 'home') ? 0 : await weighHome(ctx, { limit: 40, dry: false });
    const weights = onlyOne ? 0 : await fillWeights(ctx, 40, type);
    // D-135: liquids out of sale (shown as coming soon) before their weights matter
    const liquid = onlyOne || type === 'clothing' ? 0 : await checkLiquids(db, { dry: false });
    const packed = onlyOne || (type && type !== 'food') ? 0 : await weighFood(db);
    await db.logRun({
      started_at: started.toISOString(),
      targets_searched: searched,
      listings_added: added,
      products_checked: checks.products,
      prices_changed: checks.prices,
      stock_changed: checks.stock,
      held: checks.held,
      errors,
      shops: ctx.stats.toJSON(),
    });
    log(
      `done: ${checks.products} checked (${checks.prices} prices, ${checks.stock} stock, ${checks.held} held), ${added} listings added, ${classed} clothing options weighed by class, ${liquid} liquids archived, ${packed} food options weighed, ${home} home options weighed, ${weights} weights found`,
    );
  } finally {
    await context.close();
  }
  return full ? RESTART_CODE : errors ? 1 : 0;
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
    images: false,
  });
  const ctx: RunContext = {
    db: null,
    plan,
    // a dry run rests a shop for itself only
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

/** D-133: every food listing not yet worked out takes its packed weight (`--all`: work them all out again). */
async function food(): Promise<number> {
  const written = await weighFood(await Db.signIn(loadEnv(true)), args.includes('--all'));
  log(`done: ${written} food options packed`);
  return 0;
}

/**
 * D-134: home weights alone, from each option's own page (`--dry`: nothing written, home-weights.csv to look at;
 * `--all`: read weights already read; `--limit 200`: listings per go, 40 by default). Its own browser profile.
 */
async function home(): Promise<number> {
  const env = loadEnv(true);
  const db = await Db.signIn(env);
  const context = await openBrowser(env, {
    images: false,
    profile: profileFor(env, 'home'),
  });
  const ctx: RunContext = {
    db,
    plan: {
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
    },
    lanes: new Lanes(context),
    stats: new ShopStats(),
    known: new Set(),
    now: new Date(),
  };
  try {
    const n = await weighHome(ctx, {
      limit: Number(flag(args, '--limit')) || 40,
      dry: args.includes('--dry'),
      all: args.includes('--all'),
    });
    log(`done: ${n} home options weighed; shops: ${JSON.stringify(ctx.stats.toJSON())}`);
  } finally {
    await context.close();
  }
  return 0;
}

/** D-135: the liquid check alone (`--dry`: lists them, writes nothing; `--all`: checks checked ones again). */
async function liquids(): Promise<number> {
  const n = await checkLiquids(await Db.signIn(loadEnv(true)), {
    dry: args.includes('--dry'),
    all: args.includes('--all'),
  });
  log(`done: ${n} liquid listings ${args.includes('--dry') ? 'found' : 'archived'}`);
  return 0;
}
const main =
  command === 'liquids'
    ? liquids()
    : command === 'home'
      ? home()
      : command === 'food'
        ? food()
        : command === 'classes'
          ? classes()
          : command === 'setup'
            ? setup(args)
            : command === 'run'
              ? isChild()
                ? run(args)
                : keepRunning()
              : command === 'try'
                ? dryRun(args)
                : command === 'doctor'
                  ? doctor()
                  : null;
if (!main) {
  console.log(
    'Usage: pnpm sourcing setup [--type clothing|food|home] | doctor | classes | food [--all] | home [--dry] [--all] [--limit N] | liquids [--dry] [--all] | run [--checks|--targets] [--type clothing|food|home [--shops nishorama.com]] | try "<query>" --type food|clothing|home [--match "regex"]',
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
