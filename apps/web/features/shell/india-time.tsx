'use client';

import { useEffect, useState } from 'react';

import { indiaTime } from '@repo/shared/domain';

/**
 * India time (the homesick plan's idea 5, D-161): "It's 9:40 pm in India. Dinner, and the TV serial everyone pretends
 * not to watch." One quiet line in the footer and the phone menu, worked out in the browser (nothing on the server's
 * paint) and moved on each minute. Says "we're over there" without a word about shipping.
 */
export function IndiaTime({ className }: { className?: string }): React.JSX.Element | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  const { time, line } = indiaTime(now);
  return (
    <p className={className}>
      <span className="india-time-dot" aria-hidden="true" />
      It&rsquo;s <b className="font-semibold">{time}</b> in India. {line}
    </p>
  );
}
