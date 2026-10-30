import { DUTIES_PAID, quickOpenLine } from '@repo/shared/domain';

import { DoorStamp } from './door-stamp';
import { QuickArrives } from './quick-arrives';

/**
 * The 7-day store's promise as a parcel's address label (founder 2026-10-30: the 7-day store "is just filled with
 * text"), in place of the front page's paragraph: from India's outline to a house, the day it opens ("Order today,
 * open it Sat, Oct 31.", worked out again in the browser, D-154), duties ticked like a customs box, and a rubber stamp
 * with the weekday (door-stamp.tsx). The days come from Settings (non-negotiable 4).
 */
export function DoorLabel({
  daysMin,
  daysMax,
  total,
}: {
  daysMin: number;
  daysMax: number;
  total: number;
}): React.JSX.Element {
  return (
    <div className="door-label font-ui text-ink">
      <p className="door-label-row m-0">
        <small>From</small>
        <svg viewBox="0 0 499 537" aria-hidden="true" focusable="false">
          <use href="#india-outline" />
        </svg>
        <b className="font-semibold">India</b>
      </p>
      <p className="door-label-row m-0" data-to="">
        <small>To</small>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M3 11.5 12 3.5l9 8M5.5 9.5V21h13V9.5M10 21v-6h4v6" />
        </svg>
        <b className="font-semibold">Your door</b>
      </p>
      <span className="door-label-rule" aria-hidden="true" />
      <p className="font-heading m-0 text-[clamp(19px,1.6vw,24px)] font-medium leading-snug tracking-[-0.015em]">
        Order today, open it{' '}
        <QuickArrives
          daysMin={daysMin}
          daysMax={daysMax}
          initial={quickOpenLine(daysMin, daysMax)}
          open
        />
        .
      </p>
      <p className="text-ink-muted m-0 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        {DUTIES_PAID ? (
          <span>
            <i className="door-label-check" aria-hidden="true" />
            Duties paid
          </span>
        ) : null}
        <span>
          {total} {total === 1 ? 'piece' : 'pieces'}
        </span>
      </p>
      <DoorStamp daysMin={daysMin} daysMax={daysMax} />
    </div>
  );
}
