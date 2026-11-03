'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { enhanceMotion } from '@/features/shell/motion';

/** How far below the screen a section starts drawing: half a screen, so it is there before it is seen. */
const AHEAD = '0px 0px 50% 0px';

/**
 * Whether a lazily drawn part of Home (launch QA C-2) should be drawn now: at once when its place is on screen as the
 * page opens (a tall screen, a return to a scrolled page), else once the visitor scrolls and it comes within half a
 * screen. A page opened at the top draws only its first screen, which is what a phone shows before any scroll. `warm`
 * runs at the first scroll so the part's code is on its way before it is needed.
 */
export function useNear<T extends Element>(warm?: () => void): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    let io: IntersectionObserver | null = null;
    const watch = (): void => {
      if (io) return;
      warm?.();
      io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
        rootMargin: AHEAD,
      });
      io.observe(el);
    };
    const box = el.getBoundingClientRect();
    if (box.top < window.innerHeight && box.bottom > 0) setNear(true);
    else if (window.scrollY > 0) watch();
    else window.addEventListener('scroll', watch, { once: true, passive: true });
    return () => {
      window.removeEventListener('scroll', watch);
      io?.disconnect();
    };
  }, [near, warm]);

  return [ref, near];
}

/**
 * The component a lazily drawn part renders, loaded once it is near (null until its code is here). The box it is drawn
 * in joins the page's reveal and parallax (motion-reveal.ts) before it is painted, so it enters like the rest of Home.
 */
export function useNearComponent<P>(
  near: boolean,
  load: () => Promise<React.ComponentType<P>>,
): [React.ComponentType<P> | null, React.RefObject<HTMLDivElement | null>] {
  const [Component, setComponent] = useState<React.ComponentType<P> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!near) return;
    let live = true;
    void load().then((c) => live && setComponent(() => c));
    return () => {
      live = false;
    };
  }, [near, load]);
  useLayoutEffect(() => {
    if (Component && box.current) enhanceMotion(box.current);
  }, [Component]);
  return [Component, box];
}
