/**
 * Delivery windows (D-008). Dates arrive from the DB as 'YYYY-MM-DD' (no time
 * zone), so they are formatted as UTC calendar dates to avoid off-by-one days.
 */
function parseDate(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new RangeError(`Expected YYYY-MM-DD, got "${isoDate}"`);
  return new Date(`${isoDate}T00:00:00Z`);
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 30 – Nov 4" */
export function formatDeliveryWindow(from: string, to: string): string {
  // one day (food is exactly 7 delivery days): "Oct 29", not "Oct 29 – Oct 29"
  if (from === to) return monthDay.format(parseDate(from));
  return `${monthDay.format(parseDate(from))} – ${monthDay.format(parseDate(to))}`;
}

/** "Sun, Oct 4" for the "Order by" line (D-035). Shown in the customer's time zone when given. */
export function formatOrderBy(isoDateTime: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(
    new Date(isoDateTime),
  );
}

/**
 * D-187: a delivery day is a business day, Monday to Friday, counted from the order day; a weekend start counts from
 * the Friday before (Sat + 1 = Mon, Fri + 7 = the Tuesday after next). The twin of SQL's _add_business_days, tested on
 * the same 20 cases (tests/homesick.test.ts, supabase/tests/simple_store.test.sql).
 */
export function addBusinessDays(isoDate: string, days: number): string {
  const start = parseDate(isoDate);
  if (days <= 0) return isoDate;
  const isoDow = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
  const dow = Math.min(isoDow, 5);
  const back = Math.max(isoDow - 5, 0);
  const rest = days % 5;
  const total = -back + Math.floor(days / 5) * 7 + rest + (dow + rest > 5 ? 2 : 0);
  return new Date(start.getTime() + total * 86_400_000).toISOString().slice(0, 10);
}
