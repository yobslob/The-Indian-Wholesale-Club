'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import styles from './browse.module.css';

function FilterIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

/**
 * Phones (D-084): one Filter bar pinned under the header, with what is chosen and the count; once the page is scrolled
 * it shrinks to a round icon button in the same place. The button opens the menu's side panel (D-079 motion) with State
 * and Category as lists (server-rendered children); choosing one applies it, and the panel closes on the way.
 */
export function PhoneFilter({
  chosen,
  count,
  clearHref,
  children,
}: {
  chosen: string;
  count: string;
  /** Shown only when something is chosen. */
  clearHref: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    // The sentinel sits just above the bar: once it has gone under the header, the bar is pinned there.
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 56;
    const io = new IntersectionObserver(([e]) => setStuck(e ? !e.isIntersecting && e.boundingClientRect.top < top + 1 : false), {
      rootMargin: `-${top + 1}px 0px 0px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="contents md:hidden">
      <div ref={sentinel} aria-hidden="true" className="h-px" />
      <div className={`${styles.bar} font-ui`} data-stuck={stuck || undefined}>
        <button
          ref={button}
          type="button"
          className={styles.button}
          aria-label={`Filter: ${chosen}, ${count}`}
          aria-expanded={open}
          aria-controls="filter-panel"
          onClick={() => setOpen(true)}
        >
          <FilterIcon />
          <span className={styles.label} aria-hidden="true">
            Filter
          </span>
        </button>
        <p className={`${styles.summary} m-0`} aria-hidden="true">
          {chosen}
          <small>{count}</small>
        </p>
      </div>
      <div className="site-scrim" data-open={open || undefined} aria-hidden="true" onClick={() => setOpen(false)} />
      <aside id="filter-panel" className="site-panel font-ui" data-open={open || undefined} aria-label="Filter">
        <div className={styles.head}>
          <h2 className="font-heading">Filter</h2>
          {clearHref ? (
            <Link href={clearHref} onClick={() => setOpen(false)}>
              Clear
            </Link>
          ) : null}
          <button
            ref={close}
            type="button"
            className="site-icon"
            aria-label="Close filter"
            onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}
          >
            <HeaderIcon name="close" />
          </button>
        </div>
        {/* Any link chosen in the lists applies it; close the panel on the way. */}
        <div
          onClick={(e) => {
            if (e.target instanceof Element && e.target.closest('a')) setOpen(false);
          }}
        >
          {children}
        </div>
      </aside>
    </div>
  );
}
