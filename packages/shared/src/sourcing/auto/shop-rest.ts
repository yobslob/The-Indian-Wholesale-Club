/**
 * D-149: knowing a robot check when a shop shows one (Blinkit answered with Cloudflare's block page on 2026-10-22),
 * so a refused page is told apart from a piece that is gone. D-158 (founder 2026-10-24): a refused page only fails;
 * no shop rests and no shop is paced (D-149's rests and D-153's hourly limits are gone).
 */

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

/** A Retry-After header in milliseconds: seconds ("73954") or an HTTP date; null when absent or unreadable. */
export function retryAfterMs(headers: Record<string, string>, now: Date): number | null {
  const value = headers['retry-after']?.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(at - now.getTime(), 0);
}
