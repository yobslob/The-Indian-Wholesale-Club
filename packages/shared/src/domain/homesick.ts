import { formatDeliveryWindow } from './delivery';
import { dayDate, quickDates } from './bag-shipments';

/**
 * The homesick plan's lines (D-161): the date as a day name, the festival clock, the weekend line and India's hour.
 * Every date is worked out from the days in Settings and today (non-negotiable 4), on the database's calendar (UTC),
 * as quickDates does, so a line says what the bag and checkout will. Pure, so the website and the app share it and
 * it has tests (homesick.test.ts). The words are Claude's drafts from the plan until the founder approves them (D-059).
 */

/** "Duties paid. Nothing to pay at your door." (decision 3 of the plan): one switch for every such line. */
export const DUTIES_PAID = true;

const weekdayLong = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' });
const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' });

const at = (day: string): Date => new Date(`${day}T12:00:00Z`);

/** "Saturday" for a calendar day (YYYY-MM-DD). */
export function dayName(day: string): string {
  return weekdayLong.format(at(day));
}

/** "Sat" for a calendar day. */
export function dayShort(day: string): string {
  return weekdayShort.format(at(day));
}

/** "Sat, Oct 31" for one day, "Nov 7 – Nov 11" for a window: the plan's "at your door" date. */
export function doorDate(from: string, to: string): string {
  return from === to ? dayDate(to) : formatDeliveryWindow(from, to);
}

/** The dates an order placed now arrives (today + the days in Settings): the same sum for 7-day and standard. */
export const datesIn = quickDates;

/** Days between two calendar days (b − a). */
function daysBetween(a: string, b: string): number {
  return Math.round((at(b).getTime() - at(a).getTime()) / 86_400_000);
}

const today = (now: Date): string => now.toISOString().slice(0, 10);

/**
 * Festivals the clock counts down to: real dates only, each with its source (storefront.md §Voice: cultural facts
 * must be accurate). TODO(founder): Q-45, which festivals and their dates for 2027.
 */
export const FESTIVALS: readonly { name: string; day: string }[] = [
  // Lakshmi Puja, the main day of Diwali 2026 (the plan, from BankBazaar's holiday list)
  { name: 'Diwali', day: '2026-11-08' },
];

/** How long before a festival the clock shows (three weeks). */
const CLOCK_DAYS = 21;

export interface FestivalClock {
  name: string;
  /** "Sun, Nov 8" */
  date: string;
  /** The last day an order arrives the day before the festival, for 7-day pieces and for the rest (null: too late). */
  quickBy: string | null;
  standardBy: string | null;
  /** Today is the last day for 7-day pieces. */
  lastDay: boolean;
}

/**
 * The next festival within three weeks that an order placed today can still reach in time: arriving by the day before
 * (so a parcel is never on its way on the day itself). Null when none can, so the clock never shows a promise it
 * cannot keep (no fake urgency, D-008).
 */
export function festivalClock(
  quick: { min: number; max: number } | null,
  standard: { min: number; max: number } | null,
  now: Date = new Date(),
  festivals: readonly { name: string; day: string }[] = FESTIVALS,
): FestivalClock | null {
  const t = today(now);
  for (const f of festivals) {
    const ahead = daysBetween(t, f.day);
    if (ahead <= 0 || ahead > CLOCK_DAYS) continue;
    // the last order day: the festival − 1 − the slowest days
    const by = (days: { max: number } | null): string | null => {
      if (!days) return null;
      const last = new Date(at(f.day).getTime() - (days.max + 1) * 86_400_000).toISOString().slice(0, 10);
      return daysBetween(t, last) >= 0 ? last : null;
    };
    const quickBy = by(quick);
    const standardBy = by(standard);
    if (!quickBy && !standardBy) continue;
    return { name: f.name, date: dayDate(f.day), quickBy, standardBy, lastDay: quickBy === t };
  }
  return null;
}

/** The clock as one line: "Diwali is Sun, Nov 8. 7-day pieces ordered by Sat, Oct 31 get there in time." */
export function festivalLine(c: FestivalClock | null): string | null {
  if (!c) return null;
  if (c.standardBy) return `${c.name} is ${c.date}. Order by ${dayDate(c.standardBy)} and it all gets there in time.`;
  if (c.lastDay) return `Last day for ${c.name}: 7-day pieces ordered today get there in time.`;
  return `${c.name} is ${c.date}. 7-day pieces ordered by ${dayDate(c.quickBy!)} get there in time.`;
}

/**
 * Friday to Sunday, when an order lands exactly a week later: "Order this weekend, cook with it next weekend." (the
 * plan's idea 1; no weekend promise beyond the real weekday, decision 4). Null on other days or other day counts.
 */
export function weekendLine(quick: { min: number; max: number } | null, now: Date = new Date()): string | null {
  if (!quick || quick.min !== 7 || quick.max !== 7) return null;
  const d = now.getUTCDay();
  return d === 5 || d === 6 || d === 0 ? 'Order this weekend, cook with it next weekend.' : null;
}

/** India's hours and what they sound like (the plan's India time). */
const INDIA_HOURS: readonly [from: number, line: string][] = [
  [1, "India's asleep. Even the street dogs."],
  [5, 'Somewhere a pressure cooker just whistled.'],
  [7, "Chai's on. Someone's reading the paper out loud."],
  [9, 'Horns, tiffins and the school bus.'],
  [12, 'Lunch, then the nap nobody admits to.'],
  [15, 'Chai and samosa o’clock.'],
  [18, 'Temple bells and the evening walk.'],
  [20, 'Dinner, and the TV serial everyone pretends not to watch.'],
  [22, 'Cricket highlights and one last chai.'],
];

/** "9:40 pm" in India and the line for its hour. */
export function indiaTime(now: Date = new Date()): { time: string; line: string } {
  // India has one zone, five and a half hours ahead of UTC, with no summer time
  const ist = new Date(now.getTime() + 330 * 60_000);
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const time = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  let line = INDIA_HOURS[INDIA_HOURS.length - 1]![1]; // midnight to 1 am: still the cricket
  for (const [from, l] of INDIA_HOURS) if (h >= from) line = l;
  return { time, line };
}

/**
 * The week between today and the door, a cell a day (the week strip, D-161): only for one arrival day at most ten
 * days away (7-day pieces); null otherwise.
 */
export function weekStrip(from: string, to: string, now: Date = new Date()): { day: string; short: string }[] | null {
  if (from !== to) return null;
  const t = today(now);
  const n = daysBetween(t, to);
  if (n < 1 || n > 10) return null;
  return Array.from({ length: n + 1 }, (_, i) => {
    const day = new Date(at(t).getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { day, short: dayShort(day) };
  });
}

/** "Sat, Oct 31" (or "Nov 3 – Nov 5"): the day an order placed now is opened, "Order today, open it …" (D-161). */
export function quickOpenLine(daysMin: number, daysMax: number, now?: Date): string {
  const { from, to } = datesIn(daysMin, daysMax, now);
  return doorDate(from, to);
}
