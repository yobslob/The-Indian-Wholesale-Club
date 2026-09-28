'use client';

import { useEffect, useState } from 'react';

const dateOnlyUtc = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * A timestamp in the visitor's own time zone. The static HTML carries a UTC
 * date; the browser replaces it with local date + time after hydration.
 */
export function LocalDateTime({ iso }: { iso: string }): React.JSX.Element {
  const [text, setText] = useState(() => `${dateOnlyUtc.format(new Date(iso))} (UTC)`);
  useEffect(() => {
    setText(
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(iso)),
    );
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
