'use client';

import { datesIn, weekStrip } from '@repo/shared/domain';

import { useDays, useToday } from '@/features/shell/days';

/**
 * The week strip (D-161, Claude's idea on the homesick plan): the days from today to the door as a row of little
 * cells, today first, the arrival day a house, the running stitch drawn across them once (CSS). It answers "if I
 * order on Monday, when is it here?" at a glance. Only for one arrival day at most ten days away (7-day pieces), and
 * only in the browser (today's date). Decoration: the line beside it says the date in words.
 */
export function WeekStrip({ day }: { day?: string }): React.JSX.Element | null {
  const { quick } = useDays();
  const now = useToday();
  if (!now || (!day && !quick)) return null;
  // an order's own day (the thank-you page), else the 7-day days from today
  const { from, to } = day ? { from: day, to: day } : datesIn(quick!.min, quick!.max, now);
  const days = weekStrip(from, to, now);
  if (!days) return null;
  return (
    <ol className="week-strip" aria-hidden="true" style={{ '--n': days.length } as React.CSSProperties}>
      {days.map((d, i) => (
        <li key={d.day} data-at={i === 0 ? 'today' : i === days.length - 1 ? 'door' : undefined}>
          <span>{i === 0 ? 'Today' : d.short}</span>
          {i === days.length - 1 ? (
            <svg viewBox="0 0 24 24">
              <path d="M4 11.5 12 4l8 7.5M6.5 9.5V20h11V9.5M10 20v-5h4v5" />
            </svg>
          ) : (
            <i />
          )}
        </li>
      ))}
    </ol>
  );
}
