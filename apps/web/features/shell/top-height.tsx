'use client';

import { useEffect } from 'react';

/**
 * Keeps `--top-h` equal to the sticky banner + header (D-079), whose height changes with the width, the banner's text
 * and its open Test card. Rows that pin under it (the region page's jump pills, the See all page's state row) and the
 * anchor offset (scroll-padding-top) read it. globals.css gives a fallback until this runs. D-154: the store tabs
 * scroll away above it (.site-top sticks one strip-height up), so they are not counted.
 */
export function TopHeight(): null {
  useEffect(() => {
    const top = document.querySelector<HTMLElement>('.site-top');
    if (!top) return;
    const root = document.documentElement;
    const set = (): void => {
      const strip = top.querySelector<HTMLElement>('.store-strip')?.offsetHeight ?? 0;
      root.style.setProperty('--top-h', `${top.offsetHeight - strip}px`);
    };
    set();
    const resize = new ResizeObserver(set);
    resize.observe(top);
    return () => resize.disconnect();
  }, []);
  return null;
}
