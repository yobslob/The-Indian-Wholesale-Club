'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { festivalBanner, festivalClock } from '@repo/shared/domain';

import { useDays, useToday } from '@/features/shell/days';
import { QUICK_HOME } from '@/lib/site';

/**
 * The flight's moving part (flight.tsx; founder 2026-10-30: "make it smaller the path to be straight … make the plane
 * horizontal view … don't relate its moving with scroll, just keep it moving with constant speed very smoothly, If the
 * user scroll it off the screen then stop it there, when it is on the screen start it from there"). A side-view plane
 * crosses a straight dashed line from India to the US, towing its banner, at one steady speed, again and again: a CSS
 * animation (transform and opacity only), paused while the band is off screen and resumed from the same spot when it
 * comes back (`data-on`, one IntersectionObserver). Reduced motion: parked mid-way, still. Two drawings, one for phones
 * and one wider, so the banner's words stay readable.
 */

interface Art {
  view: [number, number];
  /** The straight route's y and its two ends. */
  y: number;
  from: number;
  to: number;
  india: [number, number, number, number];
  us: [number, number, number, number];
  font: number;
  /** The plane's size (its drawing is 44 units nose to tail). */
  plane: number;
  /** Seconds for one crossing: about the same speed on both drawings. */
  seconds: number;
}

const WIDE: Art = {
  view: [1000, 140],
  y: 72,
  from: 150,
  to: 862,
  india: [24, 14, 104, 112],
  us: [770, 14, 196, 124],
  font: 14,
  plane: 1.25,
  seconds: 11,
};
const NARROW: Art = {
  view: [400, 128],
  y: 64,
  from: 64,
  to: 330,
  india: [4, 28, 62, 67],
  us: [282, 30, 112, 71],
  font: 11.5,
  plane: 0.95,
  seconds: 8,
};

// A side view facing right (founder: "for reference take this 🛬"): body, tail fin, wing, tailplane; windows apart
const BODY =
  'M-21 -1.5 L-23 -11 L-18.5 -11 L-12 -3 L13 -3 C18 -3 22 -1.5 23 0.5 C22 2.5 18.5 3.5 14 3.5 L-16 3.5 C-19.5 3.5 -21 1.5 -21 -1.5 Z M-3 1.5 L6 1.5 L-5 10 L-9.5 10 Z M-21 0 L-14 0 L-18 4 L-22.5 4 Z';
const WINDOWS = 'M-9 -1h2v1.4h-2zM-5 -1h2v1.4h-2zM-1 -1h2v1.4h-2zM3 -1h2v1.4h-2zM7 -1h2v1.4h-2zM15 -1.6l3 0.3v1.3h-3z';

function Drawing({ art, words, className }: { art: Art; words: string; className: string }): React.JSX.Element {
  const [w, h] = art.view;
  const [ix, iy, iw, ih] = art.india;
  const [ux, uy, uw, uh] = art.us;
  // the cloth fits the words (Karla's bold runs about 0.56 em a letter)
  const cloth = Math.round(words.length * art.font * 0.56 + art.font * 1.8);
  // the rope runs from the tail to the cloth's leading edge
  const tail = -22 * art.plane;
  const edge = tail - 14;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={`flight-art ${className}`} aria-hidden="true" focusable="false">
      <use href="#india-outline" x={ix} y={iy} width={iw} height={ih} className="flight-india" />
      <use href="#us-map" x={ux} y={uy} width={uw} height={uh} className="flight-us" />
      <path className="flight-route" d={`M${art.from} ${art.y} H${art.to}`} />
      <g transform={`translate(${art.from} ${art.y})`}>
        <g
          className="flight-craft"
          style={{ '--fly-to': `${art.to - art.from}px`, animationDuration: `${art.seconds}s` } as React.CSSProperties}
        >
          <path className="flight-rope" d={`M${tail} 0 H${edge}`} />
          <g className="flight-cloth">
            <path
              d={`M${edge} ${-art.font} H${edge - cloth} l${art.font * 0.6} ${art.font} l${-art.font * 0.6} ${art.font} H${edge} Z`}
              vectorEffect="non-scaling-stroke"
            />
            <text x={edge - cloth / 2 + art.font * 0.3} y={art.font * 0.36} fontSize={art.font} textAnchor="middle">
              {words}
            </text>
          </g>
          <g transform={`scale(${art.plane})`}>
            <path className="flight-plane" d={BODY} />
            <path className="flight-windows" d={WINDOWS} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function FlightArt({
  free,
  festival,
  compact = false,
}: {
  /** "Free delivery from $49.99", from the store's policy; null hides it. */
  free: string | null;
  /** Which days the festival's last order day counts from: the 7-day store's, or any store's (Home). */
  festival: 'quick' | 'any';
  /** The narrow drawing only (flight.tsx). */
  compact?: boolean;
}): React.JSX.Element | null {
  const days = useDays();
  const now = useToday();
  const box = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  const banner = now ? festivalBanner(festivalClock(days.quick, days.standard, now), festival) : null;
  const words = banner?.words ?? free;
  // on Home a festival only the 7-day store can reach opens that store
  const href = banner?.quickOnly ? QUICK_HOME : null;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    // flying only while on screen; off screen the animation holds its place and goes on from there
    const seen = new IntersectionObserver(([entry]) => setOn(Boolean(entry?.isIntersecting)));
    seen.observe(el);
    return () => seen.disconnect();
  }, [words]);

  if (!words) return null;
  const art = (
    <div ref={box} className="flight" data-on={on ? '' : undefined}>
      {compact ? (
        <Drawing art={NARROW} words={words} className="" />
      ) : (
        <>
          <Drawing art={NARROW} words={words} className="sm:hidden" />
          <Drawing art={WIDE} words={words} className="hidden sm:block" />
        </>
      )}
    </div>
  );
  return href ? (
    <Link href={href} prefetch={false} className="block" aria-label={`${words}: open the 7-day store`}>
      {art}
    </Link>
  ) : (
    <>
      <p className="sr-only">{words}</p>
      {art}
    </>
  );
}
