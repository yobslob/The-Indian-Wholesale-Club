'use client';

import { useEffect, useState } from 'react';

import { quickArrivesLine } from '@repo/shared/domain';

/**
 * D-154: "arrives by Fri, Oct 30", the real next date for an order placed now (today + the 7-day days, Settings). The
 * page is cached, so the browser works it out again: a page built yesterday never shows yesterday's date.
 */
export function QuickArrives({ daysMin, daysMax, initial }: { daysMin: number; daysMax: number; initial: string }): React.JSX.Element {
  const [line, setLine] = useState(initial);
  useEffect(() => setLine(quickArrivesLine(daysMin, daysMax)), [daysMin, daysMax]);
  return <>{line}</>;
}
