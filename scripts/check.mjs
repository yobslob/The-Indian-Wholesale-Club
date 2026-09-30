#!/usr/bin/env node
/**
 * scripts/check.mjs — the project's single verification + timing run.
 *
 * WHY: Claude's sandboxes cannot reach the npm registry, so Claude cannot
 * install, build or test. The founder runs this on their machine; it writes
 * machine-readable results to .checks/latest.json, which Claude reads.
 * Results are FACTS for docs/plan/current.md — nothing is "verified" without one.
 *
 * Usage (from repo root):
 *   node scripts/check.mjs                 # docs, typecheck, lint, test, db, build, http, e2e, bundle
 *   node scripts/check.mjs test build      # only the named steps
 *   node scripts/check.mjs http --routes=/,/states/kerala
 *   node scripts/check.mjs db              # needs Docker + `npx supabase start` once
 *   node scripts/check.mjs build e2e       # e2e needs a fresh build + Chromium (docs/ops.md)
 *
 * Order matters: `db` resets the local database (migrations + demo seed) before the
 * build reads it and before `e2e` writes test users, orders and products into it.
 *
 * No dependencies. Works on Windows, macOS, Linux (Node >= 20).
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { gzipSync } from 'node:zlib';

const ALL_STEPS = ['docs', 'typecheck', 'lint', 'test', 'db', 'build', 'http', 'e2e', 'bundle'];
const COMMANDS = {
  // Do the docs still match the code (paths, decisions, routes, schema, env vars)? A few seconds.
  docs: 'node scripts/docs-audit.mjs',
  typecheck: 'pnpm turbo typecheck --force --continue',
  lint: 'pnpm turbo lint --force --continue',
  test: 'pnpm turbo test --force --continue',
  build: 'pnpm turbo build --filter=web --force',
  // Local Supabase only: rebuild the DB from migrations + seeds, then run the
  // invariant tests in supabase/tests (each rolls back). Never touches hosted DBs.
  db: 'npx supabase db reset && node scripts/db-test.mjs',
  // Playwright smoke flows (apps/web/e2e) against the production build on local Supabase.
  e2e: 'pnpm --filter web e2e',
  // The app must bundle for both platforms (Metro resolution + Babel on every file). The
  // output is thrown away; it catches the "works in tsc, fails in Metro" class of bugs.
  bundle:
    'pnpm --filter app exec expo export --platform android --platform ios --no-bytecode --output-dir ../../.checks/app-bundle',
};
// Routes timed by the `http` step against a production build (`next start`).
// The product route exists only with the dev demo seed (supabase/seed/demo.sql).
const DEFAULT_ROUTES = [
  '/',
  '/states',
  '/states/kerala',
  '/states/kerala/demo-kerala-kasavu-saree',
  '/clothing',
  '/search?q=saree',
  '/api/health',
];
// Speed budgets the `http` step enforces (engineering.md §Performance, D-011): a cached storefront page answers in
// ≤ 100 ms on a local production build, and no storefront page loads more than 150 KB of gzipped JS up front.
// Search reads the DB on every request and /api/health is not a page, so neither has the time budget.
const BUDGET_MS = 100;
const BUDGET_JS_KB = 150;
const UNCACHED = /^\/(search|api)(\/|\?|$)/;
const PORT = 3100;
const STEP_TIMEOUT_MS = 15 * 60 * 1000;

const args = process.argv.slice(2);
const routesArg = args.find((a) => a.startsWith('--routes='));
const routes = routesArg ? routesArg.slice(9).split(',').filter(Boolean) : DEFAULT_ROUTES;
const steps = args.filter((a) => !a.startsWith('--'));
const unknown = steps.filter((s) => !ALL_STEPS.includes(s));
if (unknown.length) {
  console.error(`Unknown step "${unknown[0]}". Valid: ${ALL_STEPS.join(', ')}`);
  process.exit(2);
}
// Always the canonical order (see the header), whatever order the steps were typed in.
const selected = steps.length ? ALL_STEPS.filter((s) => steps.includes(s)) : ALL_STEPS;
const isWin = process.platform === 'win32';

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function run(cmd) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, { shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.length > 400_000) out = out.slice(-200_000);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => killTree(child.pid), STEP_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        command: cmd,
        exitCode: code,
        ok: code === 0,
        durationMs: Date.now() - started,
        outputTail: out.split(/\r?\n/).slice(-40).join('\n'),
      });
    });
  });
}

function killTree(pid) {
  if (!pid) return;
  try {
    if (isWin) execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    else process.kill(-pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}

async function timeRequest(url) {
  const t0 = performance.now();
  const res = await fetch(url, { redirect: 'manual', cache: 'no-store' });
  const headersMs = performance.now() - t0;
  await res.arrayBuffer();
  return {
    status: res.status,
    headersMs: Math.round(headersMs),
    totalMs: Math.round(performance.now() - t0),
  };
}

// First-load JS of an HTML page: every same-origin script tag the page loads (what a visitor downloads before the
// page is interactive; code split out with dynamic import() loads later and is not counted), gzipped like the wire.
// `nomodule` scripts (Next's polyfills, ~39 KB) are skipped: browsers that run modules never download them.
const chunkKb = new Map();
async function firstLoadJsKb(base, html) {
  const tags = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"[^>]*>/g)].filter((m) => !/\snomodule\b/i.test(m[0]));
  const srcs = [...new Set(tags.map((m) => m[1].replace(/&amp;/g, '&')))].filter((src) => src.startsWith('/'));
  let total = 0;
  for (const src of srcs) {
    if (!chunkKb.has(src)) {
      const body = Buffer.from(await (await fetch(base + src)).arrayBuffer());
      chunkKb.set(src, gzipSync(body).length / 1024);
    }
    total += chunkKb.get(src);
  }
  return Math.round(total);
}

async function httpStep() {
  const started = Date.now();
  const server = spawn(`pnpm --filter web exec next start -p ${PORT}`, {
    shell: true,
    detached: !isWin,
    env: { ...process.env, NODE_ENV: 'production' },
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  const base = `http://localhost:${PORT}`;
  let ready = false;
  for (let i = 0; i < 60 && !ready; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await fetch(base, { redirect: 'manual' }).then(
      () => true,
      () => false,
    );
  }
  const results = [];
  if (ready) {
    for (const route of routes) {
      try {
        await timeRequest(base + route); // warm-up, not recorded
        const samples = [];
        for (let i = 0; i < 3; i++) samples.push(await timeRequest(base + route));
        const sorted = samples.map((s) => s.totalMs).sort((a, b) => a - b);
        const page = await fetch(base + route, { redirect: 'manual' });
        const html = (page.headers.get('content-type') ?? '').includes('text/html') ? await page.text() : null;
        const firstLoadJs = html ? await firstLoadJsKb(base, html) : undefined;
        const over = [];
        if (!UNCACHED.test(route) && sorted[1] > BUDGET_MS) over.push(`${sorted[1]} ms > ${BUDGET_MS} ms`);
        if (firstLoadJs !== undefined && firstLoadJs > BUDGET_JS_KB) over.push(`${firstLoadJs} KB JS > ${BUDGET_JS_KB} KB`);
        results.push({ route, status: samples[0].status, medianTotalMs: sorted[1], firstLoadJsKb: firstLoadJs, overBudget: over, samples });
      } catch (e) {
        results.push({ route, error: String(e) });
      }
    }
  }
  killTree(server.pid);
  return {
    ok: ready && results.every((r) => !r.error && r.status < 500 && r.overBudget.length === 0),
    durationMs: Date.now() - started,
    serverReady: ready,
    note: `medianTotalMs of 3 requests after 1 warm-up, production build, local machine; budgets: cached pages ≤ ${BUDGET_MS} ms, first-load JS ≤ ${BUDGET_JS_KB} KB gzip`,
    routes: results,
    serverLogTail: ready ? undefined : log.split(/\r?\n/).slice(-40).join('\n'),
  };
}

const report = {
  startedAt: new Date().toISOString(),
  git: {
    commit: sh('git rev-parse --short HEAD'),
    branch: sh('git rev-parse --abbrev-ref HEAD'),
    dirty: (sh('git status --porcelain') ?? '').length > 0,
  },
  machine: {
    os: `${process.platform} ${os.release()}`,
    cpus: os.cpus().length,
    memGb: Math.round(os.totalmem() / 1e9),
    node: process.version,
    pnpm: sh('pnpm -v'),
  },
  steps: {},
};

for (const step of selected) {
  process.stdout.write(`▶ ${step} … `);
  report.steps[step] = step === 'http' ? await httpStep() : await run(COMMANDS[step]);
  const r = report.steps[step];
  console.log(`${r.ok ? 'OK ' : 'FAIL'} ${(r.durationMs / 1000).toFixed(1)}s`);
}
report.finishedAt = new Date().toISOString();

mkdirSync('.checks', { recursive: true });
const json = JSON.stringify(report, null, 2);
writeFileSync('.checks/latest.json', json);
writeFileSync(`.checks/${report.startedAt.replace(/[:.]/g, '-')}.json`, json);

if (report.steps.http?.routes) {
  console.log(`\nRoute timings (median of 3; budgets ${BUDGET_MS} ms for cached pages, ${BUDGET_JS_KB} KB first-load JS):`);
  for (const r of report.steps.http.routes) {
    const js = r.firstLoadJsKb === undefined ? '' : `  ${r.firstLoadJsKb} KB JS`;
    const over = r.overBudget?.length ? `  OVER BUDGET: ${r.overBudget.join(', ')}` : '';
    console.log(`  ${r.route.padEnd(24)} ${r.error ? 'ERROR' : `${r.status}  ${r.medianTotalMs} ms${js}${over}`}`);
  }
}
console.log('\nSaved .checks/latest.json — tell Claude it is ready.');
process.exit(Object.values(report.steps).every((s) => s.ok) ? 0 : 1);
