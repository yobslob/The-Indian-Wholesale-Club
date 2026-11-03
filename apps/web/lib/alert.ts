/**
 * Founder alerts (launch QA F-3): one short message to ADMIN_ALERT_WEBHOOK_URL, a Slack, Discord or Telegram style
 * incoming webhook the founder sets (docs/monitoring.md §Alerts). The body carries `text` (Slack, Telegram) and
 * `content` (Discord) and nothing else.
 *
 * Safe to call anywhere: it never throws, gives up after 5 s, and sends only short facts (order number, amount, reason,
 * route). Keys that name a customer's contact details are dropped and email addresses or phone numbers inside values
 * are hidden, so nothing personal reaches a chat app (D-003 keeps it off customer surfaces; this keeps it off the
 * founder's phone's lock screen too). No secrets: the URL itself is the only one, and it never appears in a message.
 */

export type AlertValue = string | number | boolean | null | undefined;
export type AlertFields = Record<string, AlertValue>;

export interface AlertOptions {
  /** Defaults to ADMIN_ALERT_WEBHOOK_URL; no URL means nothing is sent (local dev). */
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const TIMEOUT_MS = 5000;
const MAX_TEXT = 1800; // Discord's limit is 2000; Slack and Telegram allow more
const MAX_VALUE = 240;

/** Keys never sent, whatever their value: a customer's contact details, credentials, request bodies. */
const BLOCKED_KEY =
  /e-?mail|phone|address|recipient|street|line[12]|city|zip|postal|name$|^name|token|secret|password|authorization|cookie|body|payload|card/i;
const EMAIL = /[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}/gi;
/** 10–15 digits with spaces, dots, dashes or brackets between them, not part of a longer id (pi_…, IWC-…). */
const PHONE = /(?<![\w-])\+?\d(?:[\s().-]*\d){9,14}(?![\w-])/g;

/** Hides email addresses and phone numbers inside a value and keeps it short. */
export function scrubValue(value: string): string {
  const clean = value.replace(EMAIL, '[hidden]').replace(PHONE, '[hidden]').replace(/\s+/g, ' ').trim();
  return clean.length > MAX_VALUE ? `${clean.slice(0, MAX_VALUE - 1)}…` : clean;
}

/** The fields that may be sent: blocked keys dropped, objects and empty values skipped, the rest scrubbed. */
export function safeFields(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (BLOCKED_KEY.test(key) || value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = scrubValue(String(value));
    }
  }
  return out;
}

/** The message text: a title line, then one `key: value` line per safe field. */
export function alertText(title: string, fields: Record<string, unknown> = {}): string {
  const lines = [`IWC: ${scrubValue(title)}`];
  for (const [key, value] of Object.entries(safeFields(fields))) lines.push(`${key}: ${value}`);
  const text = lines.join('\n');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** Cents as dollars for a message ("$12.34"); integer cents in (CLAUDE.md rule 5). */
export function alertDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Posts one alert. Resolves true when the webhook answered 2xx, false otherwise (no URL, a timeout, an error status,
 * a network failure). Never throws and never calls the logger (the logger calls this).
 */
export async function sendAlert(
  title: string,
  fields: Record<string, unknown> = {},
  options: AlertOptions = {},
): Promise<boolean> {
  const url = options.url ?? process.env.ADMIN_ALERT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const text = alertText(title, fields);
    const response = await (options.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(options.timeoutMs ?? TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ level: 'error', event: 'admin.alert_rejected', status: response.status }));
      return false;
    }
    return true;
  } catch (error) {
    const reason = error instanceof Error ? error.name : 'unknown';
    console.error(JSON.stringify({ level: 'error', event: 'admin.alert_delivery_failed', reason }));
    return false;
  }
}

// ---------------------------------------------------------------- throttle

const TEN_MINUTES = 10 * 60 * 1000;
const MAX_KEYS = 500;
const lastSent = new Map<string, number>();

/**
 * True when an alert with this key may go now: at most one per key per window, in memory (per server instance, which
 * is enough to keep a failing route from flooding the founder's phone). Old keys are dropped past 500.
 */
export function shouldAlert(key: string, now = Date.now(), windowMs = TEN_MINUTES): boolean {
  const last = lastSent.get(key);
  if (last !== undefined && now - last < windowMs) return false;
  if (lastSent.size >= MAX_KEYS) {
    for (const [k, t] of lastSent) if (now - t >= windowMs) lastSent.delete(k);
    if (lastSent.size >= MAX_KEYS) lastSent.delete(lastSent.keys().next().value as string);
  }
  lastSent.set(key, now);
  return true;
}

/** Forgets every key (tests). */
export function resetAlertThrottle(): void {
  lastSent.clear();
}

/** sendAlert, at most once per key per 10 minutes. Resolves false when throttled. */
export async function sendThrottledAlert(
  key: string,
  title: string,
  fields: Record<string, unknown> = {},
  options: AlertOptions = {},
): Promise<boolean> {
  if (!(options.url ?? process.env.ADMIN_ALERT_WEBHOOK_URL)) return false;
  if (!shouldAlert(key)) return false;
  return sendAlert(title, fields, options);
}
