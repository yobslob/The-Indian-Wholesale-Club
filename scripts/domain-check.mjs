#!/usr/bin/env node
/**
 * scripts/domain-check.mjs: is the live domain still right? (launch QA E-1, docs/ops.md §Going live on the domain)
 *
 *   node scripts/domain-check.mjs                                   # https://indianwholesaleclub.com
 *   node scripts/domain-check.mjs https://indianwholesaleclub.com --legacy=the-indian-wholesale-club.vercel.app
 *   node scripts/domain-check.mjs https://<new>.vercel.app          # a new deployment before the domain moves
 *
 * Requests every row of the launch plan's §0 table (docs/archive/launch-qa-plan.md) and fails (exit 1) on a regression:
 * pages answer 200 in time, /contact has no "coming soon", search never 5xx, /api/health under 2 s, the Stripe webhook
 * is served (a POST without a signature gets 400), robots.txt and the sitemap name the domain, `www.` → 308 apex,
 * http → https. With `--legacy=<host>` (repeatable): that host's pages 308 to the domain with path and query, while its
 * POST /api/webhooks/stripe and /api/health are served, not redirected (DOM-1). Read-only: GETs, plus POSTs to the
 * webhook that it refuses (no signature, nothing processed). Dependency-free (Node 18+).
 */
const args = process.argv.slice(2);
const base = new URL(args.find((a) => !a.startsWith('--')) ?? 'https://indianwholesaleclub.com');
const legacy = args.filter((a) => a.startsWith('--legacy=')).map((a) => a.slice('--legacy='.length)).filter(Boolean);
const origin = base.origin;
// `www.` and http → https are checked only on the real domain (not a vercel.app name, localhost or an IP)
const isApex =
  base.protocol === 'https:' && /\.[a-z]{2,}$/i.test(base.hostname) && !/^www\.|\.vercel\.app$/i.test(base.hostname);

const results = [];
const record = (level, name, detail) => results.push({ level, name, detail });
const pass = (name, detail = '') => record('PASS', name, detail);
const fail = (name, detail) => record('FAIL', name, detail);
const warn = (name, detail) => record('WARN', name, detail);

/** One request, never following redirects; status, headers, body (text) and seconds taken. */
async function hit(url, { method = 'GET', body, headers = {}, timeoutMs = 15_000 } = {}) {
  const started = performance.now();
  try {
    const res = await fetch(url, { method, body, headers, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    const text = method === 'HEAD' ? '' : await res.text();
    return { status: res.status, headers: res.headers, text, seconds: (performance.now() - started) / 1000 };
  } catch (error) {
    return { status: 0, headers: new Headers(), text: '', seconds: (performance.now() - started) / 1000, error: String(error?.cause ?? error) };
  }
}
const took = (r) => `${r.status || r.error} in ${r.seconds.toFixed(2)} s`;

async function page(path, { maxSeconds = 10, mustNotContain } = {}) {
  const r = await hit(`${origin}${path}`, { timeoutMs: maxSeconds * 1000 + 1000 });
  if (r.status !== 200) return fail(`GET ${path}`, took(r));
  if (r.seconds > maxSeconds) return fail(`GET ${path}`, `${took(r)} (limit ${maxSeconds} s)`);
  if (mustNotContain && r.text.toLowerCase().includes(mustNotContain)) return fail(`GET ${path}`, `still says "${mustNotContain}"`);
  const cache = r.headers.get('x-vercel-cache');
  pass(`GET ${path}`, `${took(r)}, ${Math.round(r.text.length / 1024)} KB${cache ? `, ${cache}` : ''}`);
  return r;
}

async function search(q) {
  const path = `/search?q=${encodeURIComponent(q)}`;
  const first = await hit(`${origin}${path}`, { timeoutMs: 11_000 });
  if (first.status >= 500 || first.status === 0) return fail(`GET ${path}`, took(first));
  if (first.seconds > 10) return fail(`GET ${path}`, `${took(first)} (limit 10 s)`);
  pass(`GET ${path}`, took(first));
  // D-2: the CDN keeps a search 5 minutes, so the same search again should be a HIT (a warning only: a new CDN
  // region or a first deploy can miss)
  const again = await hit(`${origin}${path}`, { timeoutMs: 11_000 });
  const cache = again.headers.get('x-vercel-cache');
  if (cache && cache !== 'HIT' && cache !== 'STALE') warn(`GET ${path} again`, `x-vercel-cache ${cache} (expected HIT, D-2)`);
}

async function health() {
  const r = await hit(`${origin}/api/health`, { timeoutMs: 10_000 });
  if (r.status !== 200 || r.seconds >= 2) return fail('GET /api/health', `${took(r)} (needs 200 under 2 s)`);
  const status = /"status"\s*:\s*"(\w+)"/.exec(r.text)?.[1];
  (status === 'healthy' ? pass : warn)('GET /api/health', `${took(r)}, ${status ?? 'no status'}`);
}

async function webhookServed(at) {
  const url = `${at}/api/webhooks/stripe`;
  const r = await hit(url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
  if (r.status >= 300 && r.status < 400) return fail(`POST ${url}`, `${r.status} → ${r.headers.get('location')} (Stripe never follows a redirect)`);
  if (r.status !== 400) return fail(`POST ${url}`, `${took(r)} (expected 400, missing signature)`);
  pass(`POST ${url}`, `${took(r)}, served`);
}

async function robotsAndSitemap() {
  const robots = await hit(`${origin}/robots.txt`);
  if (robots.status !== 200 || !robots.text.includes(`Sitemap: ${origin}/sitemap.xml`))
    fail('GET /robots.txt', `${took(robots)}; must name ${origin}/sitemap.xml`);
  else pass('GET /robots.txt', took(robots));
  const index = await hit(`${origin}/sitemap.xml`, { timeoutMs: 20_000 });
  const locs = [...index.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (index.status !== 200 || locs.length === 0) return fail('GET /sitemap.xml', took(index));
  const foreign = locs.find((l) => !l.startsWith(`${origin}/`));
  if (foreign) return fail('GET /sitemap.xml', `lists another address: ${foreign}`);
  if (/admin/.test(index.text)) return fail('GET /sitemap.xml', 'names the admin (D-006)');
  pass('GET /sitemap.xml', `${took(index)}, ${locs.length} entries`);
  // the index's parts (E-2d): each answers and stays on the domain
  for (const loc of locs.filter((l) => /\/sitemaps\/[^/]+\.xml$/.test(l))) {
    const part = await hit(loc, { timeoutMs: 20_000 });
    const urls = [...part.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    if (part.status !== 200 || urls.length === 0) fail(`GET ${new URL(loc).pathname}`, took(part));
    else if (urls.some((u) => !u.startsWith(`${origin}/`))) fail(`GET ${new URL(loc).pathname}`, 'lists another address');
    else pass(`GET ${new URL(loc).pathname}`, `${took(part)}, ${urls.length} addresses`);
  }
}

async function redirects() {
  if (!isApex) return warn('www and http', `skipped: ${base.hostname} is not the apex domain`);
  const www = await hit(`https://www.${base.hostname}/food?x=1`);
  const wwwTo = www.headers.get('location') ?? '';
  if (www.status !== 308 || !wwwTo.startsWith(`${origin}/food`)) fail('GET www.', `${took(www)} → ${wwwTo || 'nothing'} (expected 308 to the apex)`);
  else pass('GET www.', `308 → ${wwwTo}`);
  const http = await hit(`http://${base.hostname}/`);
  const httpTo = http.headers.get('location') ?? '';
  if (![301, 308].includes(http.status) || !httpTo.startsWith('https://')) fail('GET http://', `${took(http)} → ${httpTo || 'nothing'}`);
  else pass('GET http://', `${http.status} → ${httpTo}`);
}

async function headersCheck() {
  const r = await hit(`${origin}/`, { method: 'HEAD' });
  if (r.headers.get('cf-ray')) fail('response headers', 'cf-ray present: Cloudflare is proxying (keep DNS-only, docs/ops.md)');
  else pass('response headers', `server: ${r.headers.get('server') ?? '?'}, no cf-ray`);
  if (!r.headers.get('content-security-policy')?.includes('report-uri')) warn('response headers', 'CSP without report-uri (E-3)');
}

/** A legacy host: its name, or a full origin (http://127.0.0.1:4600 for a local test). */
async function legacyHost(host) {
  const at = host.includes('://') ? new URL(host).origin : `https://${host}`;
  const path = '/food?state=kerala';
  const r = await hit(`${at}${path}`);
  const to = r.headers.get('location') ?? '';
  if (r.status !== 308 || to !== `${origin}${path}`) fail(`GET ${host}${path}`, `${took(r)} → ${to || 'nothing'} (expected 308 to ${origin}${path})`);
  else pass(`GET ${host}${path}`, `308 → ${to}`);
  await webhookServed(at);
  const api = await hit(`${at}/api/health`, { timeoutMs: 10_000 });
  if (api.status >= 300 && api.status < 400) fail(`GET ${host}/api/health`, `${api.status} → ${api.headers.get('location')} (the app's API must be served)`);
  else if (api.status !== 200) fail(`GET ${host}/api/health`, took(api));
  else pass(`GET ${host}/api/health`, `${took(api)}, served`);
}

console.log(`Domain check: ${origin}${legacy.length ? ` (legacy: ${legacy.join(', ')})` : ''}\n`);
await page('/', { maxSeconds: 5 });
for (const p of ['/food', '/states/kerala', '/account']) await page(p, { maxSeconds: 5 });
await page('/contact', { mustNotContain: 'coming soon' });
for (const q of ['saree', 'kurti']) await search(q);
await health();
await webhookServed(origin);
await robotsAndSitemap();
await redirects();
await headersCheck();
for (const host of legacy) await legacyHost(host);

for (const r of results) console.log(`${r.level.padEnd(4)}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
const failed = results.filter((r) => r.level === 'FAIL').length;
const warned = results.filter((r) => r.level === 'WARN').length;
console.log(`\n${failed ? `${failed} failed` : 'All passed'}${warned ? `, ${warned} warning(s)` : ''}.`);
process.exit(failed ? 1 : 0);
