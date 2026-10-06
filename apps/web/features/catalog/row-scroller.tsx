'use client';

import { useEffect, useRef, useState } from 'react';

const arrow =
  'bg-paper/95 border-line text-ink absolute top-[38%] z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border shadow-sm transition-opacity hover:border-ink md:grid disabled:pointer-events-none disabled:opacity-0';

/**
 * A row of cards that scrolls sideways (D-062): swipe or trackpad on its own, plus previous / next buttons for a
 * mouse. The cards are server-rendered children; this only moves the row and hides a button at either end.
 */
export function RowScroller({ children, label }: { children: React.ReactNode; label: string }): React.JSX.Element {
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

  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className="no-scrollbar -mx-[var(--gut)] flex snap-x snap-mandatory scroll-px-[var(--gut)] gap-[var(--gap)] overflow-x-auto overscroll-x-contain px-[var(--gut)] pb-1"
      >
        {children}
      </ul>
      <button type="button" aria-label={`Scroll ${label} back`} onClick={() => move(-1)} disabled={edges.start} className={`${arrow} -left-2`}>
        <span aria-hidden="true">←</span>
      </button>
      <button type="button" aria-label={`Scroll ${label} on`} onClick={() => move(1)} disabled={edges.end} className={`${arrow} -right-2`}>
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
