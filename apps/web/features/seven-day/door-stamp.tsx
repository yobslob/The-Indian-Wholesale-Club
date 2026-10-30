'use client';

import { datesIn, dayShort } from '@repo/shared/domain';

import { useToday } from '@/features/shell/days';

/**
 * The door label's rubber stamp: the weekday the parcel opens ("SAT") once the browser knows today, the days ("7
 * DAYS") before that or when the days are a window. Decoration: the label's own line says the date in words.
 */
export function DoorStamp({
  daysMin,
  daysMax,
}: {
  daysMin: number;
  daysMax: number;
}): React.JSX.Element {
  const now = useToday();
  const one = daysMin === daysMax;
  const day = now && one ? dayShort(datesIn(daysMin, daysMax, now).to) : null;
  return (
    <span className="door-label-stamp font-ui" aria-hidden="true">
      <span className="grid place-items-center leading-none">
        <b className="font-extrabold uppercase">
          {day ?? (one ? daysMax : `${daysMin}–${daysMax}`)}
        </b>
        <small className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em]">
          {day ? 'opens' : 'days'}
        </small>
      </span>
    </span>
  );
}
