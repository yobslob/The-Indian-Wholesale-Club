'use client';

import { useEffect, useRef } from 'react';

/**
 * The end of a See all grid (founder, 2026-10-30: "the illusion of a never-ending scroll until the inventory runs
 * out"): no Show more button. When the bottom of the screen comes within a row of the last cards, the next page is
 * asked for (it is usually read ahead already, use-browse.ts). Only a shopper who reaches the very end before it lands
 * sees anything: the running stitch, turning. A failed read says Try again instead.
 */
export function MoreOnScroll({
  onNear,
  busy,
  stuck,
  count,
}: {
  onNear: () => void | Promise<void>;
  busy: boolean;
  stuck: boolean;
  /** Cards drawn so far: a new observer each time, so a short page that leaves this in view asks again. */
  count: number;
}): React.JSX.Element {
  const self = useRef<HTMLDivElement>(null);
  const call = useRef(onNear);
  call.current = onNear;

  useEffect(() => {
    const node = self.current;
    if (!node || busy || stuck) return;
    // one row: the first card's height (with its words), so the next page starts as the last row comes into view
    const first = node.parentElement?.querySelector('[data-card-grid] > *');
    const row = Math.round((first?.getBoundingClientRect().height ?? 360) * 1.15);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) void call.current();
      },
      { rootMargin: `0px 0px ${row}px 0px` },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [busy, stuck, count]);

  return (
    <div ref={self} className="grid min-h-24 place-items-center pt-8">
      {stuck ? (
        <button
          type="button"
          onClick={() => void call.current()}
          className="font-ui border-line rounded-pill min-h-11 border px-5 text-sm font-medium"
        >
          Try again
        </button>
      ) : (
        <svg
          viewBox="0 0 40 40"
          role="status"
          aria-label="Loading more"
          className="more-spin text-brand size-9"
        >
          <circle
            cx="20"
            cy="20"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}
