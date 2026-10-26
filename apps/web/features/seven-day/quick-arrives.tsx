'use client';

import { useEffect, useState } from 'react';

import { quickArrivesLine, quickOpenLine } from '@repo/shared/domain';

/**
 * D-154: "arrives by Fri, Oct 30", the real next date for an order placed now (today + the 7-day days, Settings). The
 * page is cached, so the browser works it out again: a page built yesterday never shows yesterday's date.
 */
export function QuickArrives({
  daysMin,
  daysMax,
  initial,
  open = false,
}: {
  daysMin: number;
  daysMax: number;
  initial: string;
  /** D-161: the date alone ("Sat, Oct 31"), for "Order today, open it …". */
  open?: boolean;
}): React.JSX.Element {
  const [line, setLine] = useState(initial);
  useEffect(() => setLine((open ? quickOpenLine : quickArrivesLine)(daysMin, daysMax)), [daysMin, daysMax, open]);
  return <>{line}</>;
}
