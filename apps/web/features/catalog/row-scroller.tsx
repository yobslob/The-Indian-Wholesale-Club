'use client';

import { useEffect, useRef, useState } from 'react';

const arrow =
  'bg-paper/95 border-line text-ink absolute z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border shadow-sm transition-opacity hover:border-ink md:grid disabled:pointer-events-none disabled:opacity-0';
const list = 'no-scrollbar -mx-[var(--gut)] flex overflow-x-auto overscroll-x-contain px-[var(--gut)]';

/**
 * A row of cards that scrolls sideways (D-062): swipe or trackpad on its own, plus previous / next buttons for a
 * mouse. The cards are server-rendered children; this only moves the row and hides a button at either end. `pills`:
 * the region page's jump pills, the same arrows centred on the pills (D-081).
 */
export function RowScroller({
  children,
  label,
  pills = false,
}: {
  children: React.ReactNode;
  label: string;
  pills?: boolean;
}): React.JSX.Element {
  const ref = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const row = ref.current;
    if (!row) return;
    // Called on every scroll event: re-render only when an end is reached or left, not on every frame.
    const update = (): void => {
      const start = row.scrollLeft <= 4;
      const end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    row.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  const move = (direction: 1 | -1): void => {
    const row = ref.current;
    if (!row) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: smooth ? 'smooth' : 'auto' });
  };

  const top = pills ? 'top-1/2' : 'top-[38%]'; // cards: over the photos
  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className={pills ? `${list} gap-2.5` : `${list} snap-x snap-mandatory scroll-px-[var(--gut)] gap-[var(--gap)] pb-1`}
      >
        {children}
      </ul>
      <button type="button" aria-label={`Scroll ${label} back`} onClick={() => move(-1)} disabled={edges.start} className={`${arrow} ${top} -left-2`}>
        <span aria-hidden="true">←</span>
      </button>
      <button type="button" aria-label={`Scroll ${label} on`} onClick={() => move(1)} disabled={edges.end} className={`${arrow} ${top} -right-2`}>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
