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
 *   node scripts/check.mjs                 # typecheck, lint, test, build, http, db
 *   node scripts/check.mjs test build      # only the named steps
 *   node scripts/check.mjs http --routes=/,/states/kerala
 *   node scripts/check.mjs db              # needs Docker + `npx supabase start` once
 *
 * No dependencies. Works on Windows, macOS, Linux (Node >= 20).
 */
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

const ALL_STEPS = ['typecheck', 'lint', 'test', 'build', 'http', 'db'];
const COMMANDS = {
  typecheck: 'pnpm turbo typecheck --force --continue',
  lint: 'pnpm turbo lint --force --continue',
  test: 'pnpm turbo test --force --continue',
  build: 'pnpm turbo build --filter=web --force',
  // Local Supabase only: rebuild the DB from migrations + seeds, then run the
  // invariant tests in supabase/tests (each rolls back). Never touches hosted DBs.
  db: 'npx supabase db reset && node scripts/db-test.mjs',
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
const PORT = 3100;
const STEP_TIMEOUT_MS = 15 * 60 * 1000;

const args = process.argv.slice(2);
const routesArg = args.find((a) => a.startsWith('--routes='));
const routes = routesArg ? routesArg.slice(9).split(',').filter(Boolean) : DEFAULT_ROUTES;
const steps = args.filter((a) => !a.startsWith('--'));
const selected = steps.length ? steps : ALL_STEPS;
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
  return { status: res.status, headersMs: Math.round(headersMs), totalMs: Math.round(performance.now() - t0) };
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
    ready = await fetch(base, { redirect: 'manual' }).then(() => true, () => false);
  }
  const results = [];
  if (ready) {
    for (const route of routes) {
      try {
        await timeRequest(base + route); // warm-up, not recorded
        const samples = [];
        for (let i = 0; i < 3; i++) samples.push(await timeRequest(base + route));
        const sorted = samples.map((s) => s.totalMs).sort((a, b) => a - b);
        results.push({ route, status: samples[0].status, medianTotalMs: sorted[1], samples });
      } catch (e) {
        results.push({ route, error: String(e) });
      }
    }
  }
  killTree(server.pid);
  return {
    ok: ready && results.every((r) => !r.error && r.status < 500),
    durationMs: Date.now() - started,
    serverReady: ready,
    note: 'medianTotalMs of 3 requests after 1 warm-up, production build, local machine',
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
  if (!ALL_STEPS.includes(step)) {
    console.error(`Unknown step "${step}". Valid: ${ALL_STEPS.join(', ')}`);
    process.exit(2);
  }
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
  console.log('\nRoute timings (median of 3):');
  for (const r of report.steps.http.routes) {
    console.log(`  ${r.route.padEnd(24)} ${r.error ? 'ERROR' : `${r.status}  ${r.medianTotalMs} ms`}`);
  }
}
console.log('\nSaved .checks/latest.json — tell Claude it is ready.');
process.exit(Object.values(report.steps).every((s) => s.ok) ? 0 : 1);
