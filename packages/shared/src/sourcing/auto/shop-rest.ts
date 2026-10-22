/**
 * D-149: a shop that blocks the runner (a robot check) is left alone for hours, not asked again every few seconds.
 * Blinkit answered the runner's searches with Cloudflare's block page on 2026-10-22, and each further search made
 * it stronger ("your recent actions … might have led to this"). Until then a single robot check now and then cleared
 * by the next search, so one check is a strike and two in a row rest the shop.
 */

/** Robot checks in a row (no page read between them) that rest a shop for the rest of the run and beyond. */
export const STRIKES_TO_REST = 2;

/** How long a shop rests: 2 h the first time, 6 h if it blocks again within two days, then 24 h. */
const REST_HOURS = [2, 6, 24] as const;
const REPEAT_WITHIN_MS = 48 * 3600_000;

const ROBOT_TEXT =
  /captcha|robot check|are you a robot|not a robot|verify you are (a )?human|access denied|request blocked|pardon our interruption|unusual traffic|you have been blocked/i;

/** Cloudflare's own check page ("Just a moment…"): a real browser often passes it by itself in a few seconds. */
const PASSING_CHECK = /^\s*(just a moment|checking your browser|attention required)/i;

export interface ShownPage {
  status: number | null;
  /** Response headers, lower-case names. */
  headers: Record<string, string>;
  /** The page's title and the start of its visible text. */
  shown: string;
}

/**
 * The shop answered with a robot check instead of the page: Cloudflare says so in a header, or the page shows a
 * check's words and little else (a normal shop page often loads a captcha script it never shows).
 */
export function isRobotCheck(page: ShownPage): boolean {
  if (page.headers['cf-mitigated'] === 'challenge') return true;
  return (
    (ROBOT_TEXT.test(page.shown) || PASSING_CHECK.test(page.shown)) && page.shown.length < 3000
  );
}

/** A check that may clear by itself while the page waits (Cloudflare's interstitial), not a plain refusal. */
export const mayClearByItself = (page: ShownPage): boolean =>
  page.headers['cf-mitigated'] === 'challenge' || PASSING_CHECK.test(page.shown);

export interface ShopRest {
  site: string;
  /** Not searched or read before this time (ISO). */
  until: string;
  /** Rests in a row, each within two days of the last; sets the next rest's length. */
  times: number;
  /** When this rest began (ISO). */
  since: string;
}

/** A rest never runs past two days, whatever a shop asks. */
const LONGEST_REST_MS = 48 * 3600_000;

/**
 * The rest a shop takes after blocking now, longer when it blocked again soon after the last one, and at least as
 * long as the shop itself asked (`atLeastMs`, its Retry-After: Blinkit's 429 said 73,954 s on 2026-10-22, D-153).
 */
export function nextRest(
  site: string,
  previous: ShopRest | undefined,
  now: Date,
  atLeastMs: number | null = null,
): ShopRest {
  const repeat = previous && now.getTime() - Date.parse(previous.since) < REPEAT_WITHIN_MS;
  const times = repeat ? previous.times + 1 : 1;
  const hours = REST_HOURS[Math.min(times, REST_HOURS.length) - 1]!;
  const ms = Math.min(Math.max(hours * 3600_000, atLeastMs ?? 0), LONGEST_REST_MS);
  return {
    site,
    until: new Date(now.getTime() + ms).toISOString(),
    times,
    since: now.toISOString(),
  };
}

/** A Retry-After header in milliseconds: seconds ("73954") or an HTTP date; null when absent or unreadable. */
export function retryAfterMs(headers: Record<string, string>, now: Date): number | null {
  const value = headers['retry-after']?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(at - now.getTime(), 0);
}

/**
 * D-153: pages a shop is asked for in any hour, both runners together. From the week the runner read these shops
 * without trouble (13 – 19 October): Blinkit and BigBasket took up to 60 – 95 pages an hour with at most one robot
 * check, then blocked at 100 pages in 20 minutes (BigBasket) and after a long day (Blinkit, 22 October); Zepto took up
 * to 287. A shop not named here has no hourly limit (Amazon, Flipkart, Myntra, Shopify: their own pace and 429s).
 */
export const PAGES_PER_HOUR: Readonly<Record<string, number>> = {
  'blinkit.com': 60,
  'bigbasket.com': 60,
  'swiggy.com': 60,
  'zepto.com': 90,
};

/** How long to wait before the next page so the last hour holds fewer than `perHour` pages (`times`: ms epoch). */
export function paceWaitMs(times: number[], now: number, perHour: number | undefined): number {
  if (!perHour) return 0;
  const recent = times.filter((t) => t > now - 3600_000).sort((a, b) => a - b);
  if (recent.length < perHour) return 0;
  // the page that must age out of the hour before another may go
  return recent[recent.length - perHour]! + 3600_000 - now;
}

/** The rest still running for this shop, if any. */
export const restingUntil = (rest: ShopRest | undefined, now: Date): Date | null =>
  rest && Date.parse(rest.until) > now.getTime() ? new Date(rest.until) : null;
