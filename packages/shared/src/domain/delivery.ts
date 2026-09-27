/**
 * Delivery windows (D-008). Dates arrive from the DB as 'YYYY-MM-DD' (no time
 * zone), so they are formatted as UTC calendar dates to avoid off-by-one days.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(isoDate: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new RangeError(`Expected YYYY-MM-DD, got "${isoDate}"`);
  return new Date(`${isoDate}T00:00:00Z`);
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Oct 30 – Nov 4" */
export function formatDeliveryWindow(from: string, to: string): string {
  return `${monthDay.format(parseDate(from))} – ${monthDay.format(parseDate(to))}`;
}

/** "Sun, Oct 4" for the "Order by" line (D-035). Shown in the customer's time zone when given. */
export function formatOrderBy(isoDateTime: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone }).format(
    new Date(isoDateTime),
  );
}

/**
 * flows.md §7: true when the cycle's current arrival estimate plus the slowest
 * domestic delivery no longer fits inside the window promised to the customer.
 */
export function isWindowAtRisk(input: { promisedTo: string; estArrivalOn: string; domesticDaysMax: number }): boolean {
  const latest = parseDate(input.estArrivalOn).getTime() + input.domesticDaysMax * DAY_MS;
  return latest > parseDate(input.promisedTo).getTime();
}
