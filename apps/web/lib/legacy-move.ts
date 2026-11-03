/**
 * E-1 (DOM-1): the old `*.vercel.app` addresses send their pages to the domain, and nothing else. Pure, so the
 * middleware's decision has unit tests (tests/legacy-move.test.ts).
 *
 * - Only GET and HEAD page requests on a host in `LEGACY_HOSTS` move. `/api/*` (the Stripe webhook, the app's API),
 *   `/media/*`, `/auth/*`, `/_next/*`, files (a last segment with a dot: robots.txt, sitemaps, /email/logo.png) and
 *   every other method (server actions) are served where they are: Stripe never follows a redirect, and an Android
 *   client drops its Authorization header when the host changes.
 * - A browser's first visit gets a tiny page instead of the 308 (`bounce`), because the bag lives in that host's
 *   localStorage, which no server can read: the page carries it to the domain in the address fragment
 *   (`#bag=`, bag-fragment.ts) and sets a cookie, so every later visit is a plain 308. Crawlers, curl and the app
 *   always get the 308.
 */

/** The cookie the bounce page sets on the old host: its bag has been carried, from now on a plain 308. */
export const MOVED_COOKIE = 'iwc_moved';

const SERVED_PREFIXES = ['/api/', '/media/', '/auth/', '/_next/'];
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|curl|wget/i;

/** `LEGACY_HOSTS` (comma separated host names) as a set; ports and case dropped. */
export function parseHosts(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((h) => normalHost(h))
      .filter((h) => h.length > 0),
  );
}

export function normalHost(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** A page: not one of the served prefixes (or its bare name) and not a file. */
export function isPagePath(pathname: string): boolean {
  if (SERVED_PREFIXES.some((p) => pathname.startsWith(p) || pathname === p.slice(0, -1))) return false;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  return !last.includes('.');
}

export interface MoveRequest {
  host: string | null;
  method: string;
  pathname: string;
  /** The query string with its `?`, or ''. */
  search: string;
  /** `Sec-Fetch-Mode: navigate` and `Sec-Fetch-Dest: document`: a person opening the page in a browser. */
  navigate: boolean;
  userAgent: string | null;
  /** The MOVED_COOKIE is set. */
  moved: boolean;
}

export type MoveDecision =
  | { kind: 'serve' }
  | { kind: 'redirect'; location: string }
  | { kind: 'bounce'; location: string };

/** What the middleware does with a request; `target` is the domain (siteUrl()). */
export function legacyMove(req: MoveRequest, legacyHosts: ReadonlySet<string>, target: string): MoveDecision {
  const host = normalHost(req.host);
  if (!legacyHosts.has(host)) return { kind: 'serve' };
  let base: URL;
  try {
    base = new URL(target);
  } catch {
    return { kind: 'serve' };
  }
  // never redirect a host to itself (the domain listed by mistake would loop)
  if (normalHost(base.host) === host) return { kind: 'serve' };
  if (req.method !== 'GET' && req.method !== 'HEAD') return { kind: 'serve' };
  if (!isPagePath(req.pathname)) return { kind: 'serve' };
  const location = `${base.origin}${req.pathname}${req.search}`;
  const person = req.method === 'GET' && req.navigate && !req.moved && !BOT.test(req.userAgent ?? '');
  return person ? { kind: 'bounce', location } : { kind: 'redirect', location };
}
