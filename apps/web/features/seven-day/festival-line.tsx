'use client';

import { festivalClock, festivalLine, weekendLine } from '@repo/shared/domain';

import { useDays, useToday } from '@/features/shell/days';

/**
 * The festival clock (the plan's idea 6, D-161): "Diwali is Sun, Nov 8. 7-day pieces ordered by Sat, Oct 31 get there
 * in time.", worked out in the browser from the festival's date and the days in Settings, and shown only while an
 * order can still make it (no fake urgency). Without a festival near, `weekend` shows the weekend line on Friday to
 * Sunday. Nothing on the server's paint, so a cached page never shows yesterday's countdown.
 */
export function FestivalLine({ weekend = false, className }: { weekend?: boolean; className?: string }): React.JSX.Element | null {
  const { quick, standard } = useDays();
  const now = useToday();
  if (!now) return null;
  const line = festivalLine(festivalClock(quick, standard, now)) ?? (weekend ? weekendLine(quick, now) : null);
  if (!line) return null;
  return (
    <span className={`rise-in ${className ?? ''}`}>
      <i aria-hidden="true" className="festival-diya" />
      {line}
    </span>
  );
}
