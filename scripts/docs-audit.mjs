#!/usr/bin/env node
/**
 * scripts/docs-audit.mjs: do the docs still match the code? (R8, D-012)
 *
 *   node scripts/docs-audit.mjs        (also `node scripts/check.mjs docs`)
 *
 * Mechanical checks only, no opinions:
 *  1. every repo path written in backticks in CLAUDE.md or docs/ exists
 *  2. every decision (D-xxx) and question (Q-xx) the docs or code cite is defined
 *  3. every storefront page in apps/web/app/(store) and (checkout) is listed in docs/storefront.md, and back
 *  4. every screen file in apps/app/app is named in docs/storefront.md or docs/admin.md
 *  5. every table, view and function the migrations create is named in docs/data-model.md
 *  6. every environment variable the code reads is listed in docs/ops.md
 * Dependency-free. Exits 1 with a list when something doesn't match.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const problems = [];
const read = (f) => readFileSync(f, 'utf8');

function walk(dir, keep) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.next', '.expo', '.turbo', 'dist', '.git'].includes(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, keep));
    else if (keep(full)) out.push(full);
  }
  return out;
}
const posix = (p) => p.split(path.sep).join('/');

const docFiles = ['CLAUDE.md', ...walk('docs', (f) => f.endsWith('.md'))].map(posix);
const docs = Object.fromEntries(docFiles.map((f) => [f, read(f)]));
const allDocs = Object.values(docs).join('\n');
const codeFiles = [
  ...walk('apps', (f) => /\.(ts|tsx|js|mjs)$/.test(f)),
  ...walk('packages', (f) => /\.(ts|tsx|js|mjs)$/.test(f) && !f.endsWith('database.types.ts')),
  ...walk('scripts', (f) => /\.(mjs|js|ts)$/.test(f)),
  ...walk('supabase', (f) => f.endsWith('.sql')),
].map(posix);
const code = Object.fromEntries(codeFiles.map((f) => [f, read(f)]));

// 1. Paths in backticks. Placeholders (<x>, [x], *, …, {a,b}), local env files and history
// (docs/archive, the engineering diagnosis of the old code)
// are skipped: they describe code that is gone on purpose.
const ROOTS = /^(apps|packages|supabase|scripts|docs|\.github)\//;
const isHistory = (file) => file.startsWith('docs/archive/');
function withoutHistory(file, text) {
  if (file !== 'docs/engineering.md') return text;
  const start = text.indexOf('## Diagnosis');
  const end = text.indexOf('\n## ', start + 3);
  return start < 0 ? text : text.slice(0, start) + text.slice(end);
}
for (const [file, full] of Object.entries(docs)) {
  if (isHistory(file)) continue;
  const text = withoutHistory(file, full);
  for (const [, raw] of text.matchAll(/`([^`\s]+)`/g)) {
    const p = raw.replace(/[.,:;)]+$/, '').replace(/#.*$/, '');
    if (!ROOTS.test(p) || /[<>*…{}]|\[(?!\w+\])/.test(p) || /\/\.env(\.local)?$/.test(p)) continue;
    // Next.js dynamic segments like [region] are real folder names.
    if (!existsSync(p)) problems.push(`${file}: path \`${p}\` does not exist`);
  }
}

// 2. Decision and question ids.
// The index (docs/decisions.md) and the full text of older entries (docs/archive/decisions-full.md).
const decisionText = read('docs/decisions.md') + read('docs/archive/decisions-full.md');
const decisions = new Set([...decisionText.matchAll(/\*\*(D-\d{3})\b/g)].map((m) => m[1]));
// Known questions: open ones (questions.md) and answered ones (listed there, or "was Q-n" in decisions.md).
const questions = new Set([
  ...[...read('docs/questions.md').matchAll(/\bQ-\d+\b/g)].map((m) => m[0]),
  ...[...decisionText.matchAll(/was (Q-\d+)/g)].map((m) => m[1]),
]);
const cited = (re, texts) => {
  const seen = new Map();
  for (const [file, text] of texts)
    for (const [id] of text.matchAll(re)) if (!seen.has(id)) seen.set(id, file);
  return seen;
};
for (const [id, file] of cited(/\bD-\d{3}\b/g, [
  ...Object.entries(docs),
  ...Object.entries(code),
])) {
  if (!decisions.has(id))
    problems.push(`${file}: cites ${id}, which docs/decisions.md does not define`);
}
// decisions.md names answered questions ("was Q-4"); those left questions.md on purpose.
const notDecisions = Object.entries(docs).filter(([f]) => f !== 'docs/decisions.md' && !f.startsWith('docs/archive/'));
for (const [id, file] of cited(/\bQ-\d+\b/g, [...notDecisions, ...Object.entries(code)])) {
  if (!questions.has(id))
    problems.push(`${file}: cites ${id}, which docs/questions.md does not define`);
}

// 3. Storefront pages (route groups like (store) are not part of the URL). Parallel slots (@info) hold intercepting
// routes that draw an existing page in another way (the info panel, D-092): they add no URL, so they are skipped.
const storefront = docs['docs/storefront.md'];
// Checkout has its own quiet frame (D-087) in the (checkout) group; its URLs are store pages all the same.
const storeDirs = ['apps/web/app/(store)', 'apps/web/app/(checkout)'];
const webRoutes = storeDirs.flatMap((storeDir) =>
  walk(storeDir, (f) => /page\.tsx$/.test(f) && !posix(f).includes('/@')).map((f) => {
    const rel = posix(path.relative(storeDir, path.dirname(f)));
    return (
      '/' +
      rel
        .split('/')
        .filter((s) => s && !/^\(.*\)$/.test(s))
        .join('/')
    );
  }),
);
// Addresses next.config.js rewrites to another route (the See all pages): the public address is the page; the route
// it is served from is internal and need not be listed.
const nextConfig = createRequire(import.meta.url)(path.resolve('apps/web/next.config.js'));
const rewrites = nextConfig.rewrites ? await nextConfig.rewrites() : [];
const rewriteRules = Array.isArray(rewrites) ? rewrites : [...(rewrites.beforeFiles ?? []), ...(rewrites.afterFiles ?? [])];
const rewritten = new Set(
  rewriteRules.flatMap((r) => {
    // /:type(clothing|food) and, inside the 7-day store (D-154), /7-day-delivery/:type(food|home-and-gifts)
    const alt = r.source.match(/^(.*)\/:\w+\(([^)]+)\)$/);
    return alt ? alt[2].split('|').map((s) => `${alt[1]}/${s}`) : [r.source];
  }),
);
const internal = rewriteRules.map((r) => '/' + r.destination.split('/')[1]);
const documented = new Set(
  [...storefront.matchAll(/`(\/[^`\s]*)`/g)].map(
    (m) => m[1].replace(/\?.*$/, '').replace(/\/$/, '') || '/',
  ),
);
for (const route of webRoutes) {
  // the dynamic route a rewrite serves (/see-all/[type]/…, /7-day-delivery/[type]/[category]), not its plain pages
  if (internal.some((prefix) => route.startsWith(`${prefix}/`) && route.includes('['))) continue;
  if (!documented.has(route === '/' ? '/' : route))
    problems.push(`docs/storefront.md: page ${route} is not listed`);
}
const routeTable = storefront.slice(
  storefront.indexOf('## Web routes'),
  storefront.indexOf('## ', storefront.indexOf('## Web routes') + 3),
);
const tableRows = routeTable
  .split('\n')
  .filter((l) => l.startsWith('|'))
  .join('\n');
for (const [, r] of tableRows.matchAll(/`(\/[^`\s]*)`/g)) {
  const route = r.replace(/\/$/, '') || '/';
  if (route.startsWith('/api')) continue;
  if (!webRoutes.includes(route) && !rewritten.has(route.replace(/\?.*$/, '')))
    problems.push(`docs/storefront.md: lists ${route}, which has no page`);
}

// 4. App screens: each file under apps/app/app is named (by its route path) in the docs.
const appDocs = storefront + docs['docs/admin.md']; // vendor mode: admin.md §Vendor screens (D-103)
for (const f of walk('apps/app/app', (x) => x.endsWith('.tsx')).map(posix)) {
  const rel = f.replace('apps/app/app/', '').replace(/\.tsx$/, '');
  // Layouts and tab home screens (index) are covered by the tab lists in the docs.
  if (rel.endsWith('_layout') || rel.endsWith('index')) continue;
  const route = rel
    .split('/')
    .filter((s) => !/^\(.*\)$/.test(s))
    .join('/');
  const leaf = route.split('/').pop();
  const named =
    appDocs.includes(route) ||
    appDocs.includes(rel) ||
    (leaf !== 'index' && new RegExp(`\\b${leaf}\\b`, 'i').test(appDocs));
  if (!named) problems.push(`docs: app screen ${f} is not described in storefront.md or admin.md`);
}

// 5. Schema objects.
const dataModel = docs['docs/data-model.md'];
const sql = Object.entries(code)
  .filter(([f]) => f.startsWith('supabase/migrations/'))
  .map(([, t]) => t)
  .join('\n');
const objects = new Set();
for (const [, name] of sql.matchAll(
  /create\s+(?:or\s+replace\s+)?(?:table|view)\s+public\.(\w+)/gi,
))
  objects.add(name);
// Functions: the callable ones (granted to a role). Trigger functions and internal helpers
// aren't granted to anyone and are documented by the invariant they enforce.
for (const [, list] of sql.matchAll(/grant\s+execute\s+on\s+function\s+([\s\S]*?)\s+to\s+/gi)) {
  for (const [, name] of list.matchAll(/public\.(\w+)\s*\(/g)) objects.add(name);
}
for (const name of objects) {
  if (!new RegExp(`\\b${name}\\b`).test(dataModel))
    problems.push(`docs/data-model.md: ${name} (migrations) is not described`);
}

// 6. Environment variables read by code.
const ops = docs['docs/ops.md'];
const envVars = new Map();
for (const [file, text] of Object.entries(code)) {
  if (file.startsWith('supabase/')) continue;
  for (const [, name] of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g))
    if (!envVars.has(name)) envVars.set(name, file);
}
// Set by the platform or a tool, never by us. NAME: a comment's placeholder; NATIVEWIND_OS: NativeWind's Metro plugin.
const PLATFORM = new Set(['NODE_ENV', 'CI', 'PORT', 'NAME', 'NATIVEWIND_OS']);
for (const [name, file] of envVars) {
  if (!PLATFORM.has(name) && !ops.includes(name))
    problems.push(`docs/ops.md: ${name} (read in ${file}) is not listed`);
}

if (problems.length) {
  console.log(`Docs audit: ${problems.length} mismatch(es)\n`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}
console.log(
  `Docs audit: OK (${docFiles.length} docs, ${webRoutes.length} web pages, ${objects.size} schema objects, ${envVars.size} env vars, ${decisions.size} decisions)`,
);
