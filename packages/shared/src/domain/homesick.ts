import { dayDate } from './bag-shipments';
import { addBusinessDays, formatDeliveryWindow } from './delivery';

/**
 * The homesick plan's lines that stay (D-161, D-187): the duties stamp and the dates for checkout and the order page.
 * Store pages say "delivery days", no calendar date. Pure, so the website and the app share it (homesick.test.ts).
 */

/** "Duties paid. Nothing to pay at your door." (decision 3 of the plan): one switch for every such line. */
export const DUTIES_PAID = true;

const weekdayLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });

/** "Saturday" for a calendar day (YYYY-MM-DD). */
export function dayName(day: string): string {
  return weekdayLong.format(new Date(`${day}T12:00:00Z`));
}

/** "Sat, Oct 31" for one day, "Nov 7 – Nov 11" for a window. */
export function doorDate(from: string, to: string): string {
  return from === to ? dayDate(to) : formatDeliveryWindow(from, to);
}

/**
 * The dates an order placed now arrives: today + the delivery days (Settings), counted in business days, on the
 * database's calendar (UTC), so the browser says what the order will.
 */
export function datesIn(daysMin: number, daysMax: number, now: Date = new Date()): { from: string; to: string } {
  const today = now.toISOString().slice(0, 10);
  return { from: addBusinessDays(today, daysMin), to: addBusinessDays(today, daysMax) };
}
