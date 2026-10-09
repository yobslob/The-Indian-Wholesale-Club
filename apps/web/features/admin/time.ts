import type { Enum } from '@repo/db';

/**
 * Times in the admin's own desk zone, the other desk's beside them, never UTC (D-096). The US desk works from New
 * Jersey, the India desk from India (D-007). An admin without a desk sees New Jersey first, where the business is.
 */
export type Desk = Enum<'ops_desk'>;

export const ZONES: Record<Desk, { tz: string; place: string; abbr: string }> = {
  us: { tz: 'America/New_York', place: 'New Jersey', abbr: 'ET' },
  india: { tz: 'Asia/Kolkata', place: 'India', abbr: 'IST' },
};

/** [own desk, the other desk]. */
export function deskOrder(desk: Desk | null): [Desk, Desk] {
  return desk === 'india' ? ['india', 'us'] : ['us', 'india'];
}

const fmt = new Map<string, Intl.DateTimeFormat>();
function format(tz: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${tz}|${JSON.stringify(opts)}`;
  let f = fmt.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: tz, ...opts });
    fmt.set(key, f);
  }
  return f;
}

const DAY: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** "Oct 8, 9:38 AM" in the desk's zone, and the other zone's time ("6:08 PM IST", with its day when it differs). */
export function deskTime(iso: string | Date, desk: Desk | null): { main: string; other: string } {
  const at = typeof iso === 'string' ? new Date(iso) : iso;
  const [own, other] = deskOrder(desk).map((d) => ZONES[d]) as [(typeof ZONES)[Desk], (typeof ZONES)[Desk]];
  const ownDay = format(own.tz, DAY).format(at);
  const otherDay = format(other.tz, DAY).format(at);
  const otherTime = format(other.tz, TIME).format(at);
  return {
    main: `${ownDay}, ${format(own.tz, TIME).format(at)}`,
    other: `${otherDay === ownDay ? '' : `${otherDay}, `}${otherTime} ${other.abbr}`,
  };
}

/** One line: "Oct 8, 9:38 AM (6:08 PM IST)", for sentences and timelines. */
export function deskTimeLine(iso: string | null | undefined, desk: Desk | null): string {
  if (!iso) return '—';
  const t = deskTime(iso, desk);
  return `${t.main} (${t.other})`;
}

/** A date with no time (est. arrival, delivery windows): "Oct 30". Dates are calendar days, not instants. */
export function shortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  return format('UTC', DAY).format(new Date(`${isoDate}T12:00:00Z`));
}

/** "Oct 30 – Nov 4" from two calendar dates. */
export function dateRange(from: string | null | undefined, to: string | null | undefined): string {
  if (!from && !to) return '—';
  return from === to || !to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
}

/**
 * A wall-clock time typed in a zone ("2026-10-10T23:59" in New Jersey) → the instant, as ISO. For the cycle cutoff,
 * entered in the admin's own zone (D-096) and stored as an instant.
 */
export function zonedToIso(local: string, desk: Desk | null): string {
  const tz = ZONES[deskOrder(desk)[0]].tz;
  const guess = new Date(`${local}:00Z`);
  const parts = Object.fromEntries(
    format(tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const shown = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
  return new Date(guess.getTime() - (shown - guess.getTime())).toISOString();
}

/** The instant → "2026-10-10T23:59" in the desk's zone, for a datetime-local field's value. */
export function isoToZoned(iso: string, desk: Desk | null): string {
  const tz = ZONES[deskOrder(desk)[0]].tz;
  const parts = Object.fromEntries(
    format(tz, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
