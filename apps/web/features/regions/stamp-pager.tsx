'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './stamps.module.css';

/**
 * Pages of stamps (D-080): one page per arrow click, a smooth slide (instant under reduced motion), each arrow hidden
 * at its end, the count following the page. Swipe and trackpads scroll the same track.
 */
export function StampPager({ count, children }: { count: number; children: React.ReactNode }): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const sync = (): void => setPage(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener('scroll', sync, { passive: true });
    return () => el.removeEventListener('scroll', sync);
  }, []);

  const go = (dir: 1 | -1): void => {
    const el = track.current;
    if (!el) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <div className={styles.pager}>
      <div ref={track} className={styles.pages}>
        {children}
      </div>
      <button type="button" className={`${styles.arrow} ${styles.prev} font-ui`} aria-label="Previous states" disabled={page <= 0} onClick={() => go(-1)}>
        ←
      </button>
      <button type="button" className={`${styles.arrow} ${styles.next} font-ui`} aria-label="More states" disabled={page >= count - 1} onClick={() => go(1)}>
        →
      </button>
      <span className={`${styles.count} font-ui`} aria-live="polite">
        {page + 1} / {count}
      </span>
    </div>
  );
}
