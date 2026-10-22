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

/** The rest a shop takes after blocking now, longer when it blocked again soon after the last one. */
export function nextRest(site: string, previous: ShopRest | undefined, now: Date): ShopRest {
  const repeat = previous && now.getTime() - Date.parse(previous.since) < REPEAT_WITHIN_MS;
  const times = repeat ? previous.times + 1 : 1;
  const hours = REST_HOURS[Math.min(times, REST_HOURS.length) - 1]!;
  return {
    site,
    until: new Date(now.getTime() + hours * 3600_000).toISOString(),
    times,
    since: now.toISOString(),
  };
}

/** The rest still running for this shop, if any. */
export const restingUntil = (rest: ShopRest | undefined, now: Date): Date | null =>
  rest && Date.parse(rest.until) > now.getTime() ? new Date(rest.until) : null;
