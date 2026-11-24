import Link from 'next/link';

import { dayDate } from '@repo/shared/domain';

import { Flight } from '@/features/visuals/flight';
import { VisualSlot } from '@/features/visuals/visual-slot';

import { Arrow, Leaf } from './homecoming-art';
import { SEASON, WIDE } from './homecoming-hooks';

/**
 * Home's season window: Homecoming, for Thanksgiving (D-196; built for Diwali, founder 2026-10-31, D-174: "convert this
 * into an ad/banner types component … show this airplane flying inside somewhere the card"). A dusk: a garland of
 * leaves along its top, two leaves drifting down and the flight crossing it with its banner (the free line,
 * flight.tsx): home, on its way over. D-204: the row of three arch windows under the hero gave way to Cook at home
 * (founder 2026-11-23: "let's remove the windows and put something else, just for recipes"). Server-drawn; the only
 * client part is the flight. Loops move transform and opacity only, pause off screen (`data-album`, motion.tsx) and
 * stop with reduced motion.
 */

const LEAVES = 17;

/** A garland: a thread with autumn leaves hanging from it, each swaying out of step. */
export function Garland(): React.JSX.Element {
  // the thread is a quadratic curve; a leaf at t hangs from it at 4·sag·t(1−t)
  return (
    <div className="hc-garland" aria-hidden="true">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M0 0 Q50 20 100 0" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: LEAVES }, (_, i) => {
        const t = (i + 0.5) / LEAVES;
        return (
          <i
            key={i}
            style={
              {
                left: `${t * 100}%`,
                top: `${4 * 10 * t * (1 - t)}px`,
                '--i': i,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** The dusk with the flight inside (the founder's "Host your … under $99", D-174 – D-176): its own row, spanning it. */
export function HomecomingDusk({ free }: { free: string | null }): React.JSX.Element {
  return (
    <section aria-label={SEASON.wide} className="hc" data-album="">
      <div className="hc-row">
        <div className="hc-wide">
          {/* D-175: the founder's photo on the card's right, fading into it */}
          <VisualSlot id={WIDE.slot} className="hc-photo hc-photo--night" />
          <Garland />
          <Leaf className="hc-leaf--a" />
          <Leaf className="hc-leaf--b" />
          <div className="hc-wide-words">
            {SEASON.day ? (
              <p className="hc-kicker font-ui">
                {SEASON.name} · {dayDate(SEASON.day)}
              </p>
            ) : null}
            <h2 className="font-heading text-[clamp(26px,2.5vw,40px)] font-medium leading-[1.05] tracking-[-0.025em]">
              {/* D-193: the words turn over between the two; both are in the page for screen readers */}
              <span className="hc-flip">
                <span>{WIDE.hook} </span>
                <span>{WIDE.flip}</span>
              </span>
            </h2>
            <Link href={WIDE.href} prefetch={false} className="hc-go hc-go--night font-ui">
              {WIDE.cta}
              <Arrow />
            </Link>
          </div>
          <div className="hc-sky">
            <Flight free={free} compact />
          </div>
        </div>
      </div>
    </section>
  );
}
