'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { festivalBanner, festivalClock } from '@repo/shared/domain';

import { useDays, useToday } from '@/features/shell/days';
import { QUICK_HOME } from '@/lib/site';

/**
 * The flight (founder 2026-10-30: "a plane flying from india to us carrying a banner of diwali or free delivery on
 * 49.99"): a little plane leaves the India outline, draws the brand's running stitch across the band and parks before
 * a house, towing a cloth banner. The banner says the free-delivery line (from the store's policy) or, while a festival
 * is near and an order can still make it, "For Diwali, order by Oct 31" (festivalClock, D-161: never a promise it
 * cannot keep). It flies once, when the band comes into view; with reduced motion it is parked from the start.
 * Two drawings, one for phones and one wider, so the banner's words stay readable; no image, no request.
 */

interface Art {
  view: [number, number];
  route: string;
  /** The route's end and its heading there, so the parked plane is in the page's HTML before any script runs. */
  end: [number, number, number];
  india: [number, number, number, number];
  house: [number, number, number];
  font: number;
  /** The plane's size (its drawing is 38 units nose to tail). */
  plane: number;
}

const heading = (c2: [number, number], end: [number, number]): number =>
  (Math.atan2(end[1] - c2[1], end[0] - c2[0]) * 180) / Math.PI;

const WIDE: Art = {
  view: [1000, 230],
  route: 'M118 132 C290 0 600 100 840 110',
  end: [840, 110, heading([600, 100], [840, 110])],
  india: [20, 96, 118, 128],
  house: [906, 150, 58],
  font: 19,
  plane: 1.4,
};
const NARROW: Art = {
  view: [400, 250],
  route: 'M74 176 C120 40 230 98 322 112',
  end: [322, 112, heading([230, 98], [322, 112])],
  india: [8, 150, 84, 92],
  house: [350, 168, 40],
  font: 15,
  plane: 1.1,
};

const FLY_MS = 3400;
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function Drawing({
  art,
  words,
  className,
}: {
  art: Art;
  words: string;
  className: string;
}): React.JSX.Element {
  const [w, h] = art.view;
  const [ix, iy, iw, ih] = art.india;
  const [hx, hy, hs] = art.house;
  // the cloth fits the words (Karla's bold runs about 0.56 em a letter)
  const cloth = Math.round(words.length * art.font * 0.56 + art.font * 1.8);
  // the rope runs from the tail to the cloth's leading edge
  const tail = -20 * art.plane;
  const edge = tail - 16;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`flight-art ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={`trail-${w}`} maskUnits="userSpaceOnUse">
          <path className="flight-reveal" d={art.route} pathLength={1} />
        </mask>
      </defs>
      <use href="#india-outline" x={ix} y={iy} width={iw} height={ih} className="flight-india" />
      <path className="flight-route" d={art.route} />
      <path className="flight-trail" d={art.route} mask={`url(#trail-${w})`} />
      <g
        className="flight-house"
        transform={`translate(${hx - hs / 2} ${hy - hs / 2}) scale(${hs / 24})`}
      >
        <path d="M3 11.5 12 3.5l9 8M5.5 9.5V21h13V9.5M10 21v-6h4v6" />
      </g>
      <g
        className="flight-craft"
        transform={`translate(${art.end[0]} ${art.end[1]}) rotate(${art.end[2]})`}
      >
        <path className="flight-rope" d={`M${tail} 0 H${edge}`} />
        <g className="flight-cloth">
          <path
            d={`M${edge} ${-art.font} H${edge - cloth} l${art.font * 0.6} ${art.font} l${-art.font * 0.6} ${art.font} H${edge} Z`}
          />
          <text
            x={edge - cloth / 2 + art.font * 0.3}
            y={art.font * 0.36}
            fontSize={art.font}
            textAnchor="middle"
          >
            {words}
          </text>
        </g>
        <path
          className="flight-plane"
          transform={`scale(${art.plane})`}
          d="M18 0 L6 -3 L-2 -15 L-7 -15 L-3 -3 L-13 -2.5 L-17 -8 L-20 -8 L-18 0 L-20 8 L-17 8 L-13 2.5 L-3 3 L-7 15 L-2 15 L6 3 Z"
        />
      </g>
    </svg>
  );
}

export function Flight({
  free,
  festival,
}: {
  /** "Free delivery from $49.99", from the store's policy; null hides it. */
  free: string | null;
  /** Which days the festival's last order day counts from: the 7-day store's, or any store's (Home). */
  festival: 'quick' | 'any';
}): React.JSX.Element | null {
  const days = useDays();
  const now = useToday();
  const box = useRef<HTMLDivElement>(null);
  const [flying, setFlying] = useState(false);

  const banner = now
    ? festivalBanner(festivalClock(days.quick, days.standard, now), festival)
    : null;
  const words = banner?.words ?? free;
  // on Home a festival only the 7-day store can reach opens that store
  const href = banner?.quickOnly ? QUICK_HOME : null;

  useEffect(() => {
    const el = box.current;
    if (!el || !words || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = [...el.querySelectorAll<SVGSVGElement>('.flight-art')].find(
      (s) => s.getBoundingClientRect().width > 0,
    );
    const route = svg?.querySelector<SVGPathElement>('.flight-route');
    const craft = svg?.querySelector<SVGGElement>('.flight-craft');
    const reveal = svg?.querySelector<SVGPathElement>('.flight-reveal');
    if (!svg || !route || !craft || !reveal) return;
    const length = route.getTotalLength();
    const place = (p: number): void => {
      const at = route.getPointAtLength(p * length);
      const ahead = route.getPointAtLength(Math.min(p * length + 1, length));
      const behind = route.getPointAtLength(Math.max(p * length - 1, 0));
      const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
      craft.setAttribute('transform', `translate(${at.x} ${at.y}) rotate(${angle})`);
      reveal.style.strokeDashoffset = String(1 - p);
    };
    reveal.style.strokeDasharray = '1 1';
    place(0);
    let frame = 0;
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        setFlying(true);
        const start = performance.now();
        const step = (t: number): void => {
          const p = Math.min((t - start) / FLY_MS, 1);
          place(ease(p));
          if (p < 1) frame = requestAnimationFrame(step);
          else setFlying(false);
        };
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.45 },
    );
    seen.observe(el);
    return () => {
      seen.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [words]);

  if (!words) return null;
  const art = (
    <div ref={box} className="flight" data-flying={flying ? '' : undefined}>
      <Drawing art={NARROW} words={words} className="sm:hidden" />
      <Drawing art={WIDE} words={words} className="hidden sm:block" />
    </div>
  );
  return (
    <section aria-label="From India to your door" className="flight-band">
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="block"
          aria-label={`${words}: open the 7-day store`}
        >
          {art}
        </Link>
      ) : (
        <>
          <p className="sr-only">{words}</p>
          {art}
        </>
      )}
    </section>
  );
}
