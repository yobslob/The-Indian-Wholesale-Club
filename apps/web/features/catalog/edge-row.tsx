'use client';

import { useEffect, useRef } from 'react';

import styles from './browse.module.css';

/**
 * A pill row that scrolls sideways with soft ends (D-084, D-098): marks which side has more so only that end fades.
 * The pills are server-rendered children. Attributes are set directly on scroll, without re-rendering.
 */
export function EdgeRow({
  label,
  blur = false,
  children,
}: {
  label: string;
  /** The very light blur under the fade; never on a pinned row (D-098). */
  blur?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const wrap = box.current;
    const row = nav.current;
    if (!wrap || !row) return;
    const update = (): void => {
      wrap.toggleAttribute('data-more-l', row.scrollLeft > 4);
      wrap.toggleAttribute('data-more-r', row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    };
    update();
    // The chosen pill may sit off screen after a filter: bring it into view once.
    row.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    row.addEventListener('scroll', update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, []);

  return (
    <div ref={box} className={styles.edge} data-blur={blur || undefined}>
      <nav ref={nav} aria-label={label}>
        {children}
      </nav>
    </div>
  );
}
