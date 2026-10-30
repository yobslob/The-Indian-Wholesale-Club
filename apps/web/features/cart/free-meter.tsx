'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * The free-delivery bar (D-116): a track with a fill up to `share`, a glowing head at its end and a shimmer running
 * through the filled part; `surge` (from useSurge) flares the head once per add. `tone` "canvas" is the bag summary's
 * brand-on-cream version of the pill's light-on-brand one.
 */
export function FreeMeter({
  share,
  more = null,
  surge,
  tone = 'brand',
  route = true,
}: {
  share: number;
  /** Past the free line: the bulk saving's share of its cap, drawn as a second part after the house; null for none. */
  more?: number | null;
  surge: number;
  tone?: 'brand' | 'canvas';
  /** The flight path's ends: India and the house (D-161). */
  route?: boolean;
}): React.JSX.Element {
  const full = share >= 1;
  const bar = (
    <span
      className="fd-bar"
      data-tone={tone}
      data-full={full || undefined}
      aria-hidden="true"
      style={{ '--fd': full ? 1 : Math.max(share, 0.04) } as React.CSSProperties}
    >
      <span className="fd-fill" />
      <i key={surge} className="fd-head" data-surge={surge > 0 || undefined} />
    </span>
  );
  if (!route) return bar;
  // D-161 (the plan's flight path): from the India outline (the layout's #india-mark) along the stitch to a house.
  // Founder 2026-10-30: past the line the route goes on from the house to a price tag, the bulk saving filling it; the
  // part to the house stays full. Always drawn (empty and folded away before the line), so it grows out of the house.
  const saving = more ?? 0;
  return (
    <span
      className="fd-route"
      data-tone={tone}
      data-full={full || undefined}
      data-more={more === null ? undefined : ''}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="fd-end">
        <use href="#india-mark" />
      </svg>
      {bar}
      <svg viewBox="0 0 24 24" className="fd-end" data-house="">
        <path d="M4 11.5 12 4l8 7.5M6.5 9.5V20h11V9.5M10 20v-5h4v5" />
      </svg>
      <span
        className="fd-bar fd-more"
        data-tone={tone}
        data-full={saving >= 1 || undefined}
        style={{ '--fd': saving >= 1 ? 1 : Math.max(saving, 0.04) } as React.CSSProperties}
      >
        <span className="fd-fill" />
        <i key={surge} className="fd-head" data-surge={(more !== null && surge > 0) || undefined} />
      </span>
      <svg viewBox="0 0 24 24" className="fd-end fd-tag">
        <path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5z" />
        <circle cx="8" cy="8.5" r="1.4" />
      </svg>
    </span>
  );
}

/** A number that goes up each time `share` grows, so the meter's edge can flare once per add (not on the first draw). */
export function useSurge(share: number): number {
  const last = useRef<number | null>(null);
  const [surge, setSurge] = useState(0);
  useEffect(() => {
    if (last.current !== null && share > last.current + 0.001) setSurge((n) => n + 1);
    last.current = share;
  }, [share]);
  return surge;
}
