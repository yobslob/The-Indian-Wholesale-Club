/**
 * Days until a shop's delivery promise reaches the hub (D-118), from what its page prints: "15 MINS", "Delivery in
 * 14 minutes", "Tomorrow", "FREE delivery Wednesday, 21 October", "Delivery by Fri, 16 Oct", "Get it by 16 - 18 Oct",
 * "in 2-3 days". Dates win over durations (Amazon's "Order within 3 hrs 20 mins" is not the delivery), and of
 * several dates the latest counts (the free delivery, not the paid fastest one). Days are counted in India's time.
 * Null when the text promises nothing readable.
 */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const IST_MS = 5.5 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;

/** Today's date in India as a UTC midnight timestamp. */
function istToday(now: Date): number {
  const ist = new Date(now.getTime() + IST_MS);
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
}

function datesIn(text: string, today: number): number[] {
  const year = new Date(today).getUTCFullYear();
  const found: number[] = [];
  const add = (day: number, month: number): void => {
    if (day < 1 || day > 31 || month < 0) return;
    let at = Date.UTC(year, month, day);
    if (at < today - 30 * DAY_MS) at = Date.UTC(year + 1, month, day); // "2 Jan" seen in late December
    found.push(at);
  };
  const month = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
  // "16 - 18 Oct", "21 October", "21st Oct"
  for (const m of text.matchAll(
    new RegExp(
      `(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–]\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+${month}`,
      'g',
    ),
  )) {
    const mon = MONTHS.indexOf(m[3]!);
    add(Number(m[1]), mon);
    if (m[2]) add(Number(m[2]), mon);
  }
  // "Oct 21", "October 16 - 18"
  for (const m of text.matchAll(
    new RegExp(`${month}\\s+(\\d{1,2})(?!\\d)(?:\\s*[-–]\\s*(\\d{1,2}))?`, 'g'),
  )) {
    const mon = MONTHS.indexOf(m[1]!);
    add(Number(m[2]), mon);
    if (m[3]) add(Number(m[3]), mon);
  }
  return found;
}

export function parseDeliveryDays(
  raw: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!raw) return null;
  const text = raw
    .toLowerCase()
    .replace(/order within[^.|]*/g, ' ')
    .replace(/\s+/g, ' ');
  const today = istToday(now);

  const dates = datesIn(text, today);
  if (dates.length) {
    const days = Math.round((Math.max(...dates) - today) / DAY_MS);
    return days >= 0 && days <= 60 ? days : null;
  }
  if (/\btomorrow\b/.test(text)) return 1;
  if (/\btoday\b|\btonight\b/.test(text)) return 0;
  const weekday = text.match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/);
  if (weekday && /\b(by|on|delivery|arrives|get it)\b/.test(text)) {
    const wanted = DAYS.indexOf(weekday[1]!);
    const from = new Date(today).getUTCDay();
    return (wanted - from + 7) % 7 || 7;
  }
  if (/\b\d+\s*(min|mins|minutes)\b/.test(text)) return 0;
  const hours = text.match(/\b(\d+)\s*(hr|hrs|hour|hours)\b/);
  if (hours) return Number(hours[1]) < 24 ? 0 : Math.ceil(Number(hours[1]) / 24);
  const range = text.match(
    /\b(?:in|within)\s+(\d+)(?:\s*(?:-|to)\s*(\d+))?\s*(?:business |working )?days?\b/,
  );
  if (range) return Number(range[2] ?? range[1]);
  return null;
}
