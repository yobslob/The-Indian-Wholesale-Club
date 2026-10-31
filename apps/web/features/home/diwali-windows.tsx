import Link from 'next/link';

import { dayDate } from '@repo/shared/domain';

import { Flight } from '@/features/visuals/flight';
import { VisualSlot, slotShown } from '@/features/visuals/visual-slot';

import { Arrow, ArchLine, Burst, Diya, WindowArt } from './diwali-art';
import { ARCHES, WIDE } from './diwali-hooks';

/**
 * The Diwali windows (founder 2026-10-31, D-174: "convert this into an ad/banner types component … Diwali decoration
 * types arch windows for each category … show this airplane flying inside somewhere the card"): where the full-width
 * flight was, a row of festive windows under a toran. The wide one is a Diwali night: string lights, two fireworks and
 * the flight crossing it with its banner (the free line or the festival's last order day, flight.tsx). Then an arch
 * window per hook (diwali-hooks.ts), each with its drawing and a diya on the sill. Desktop: one row; tablet: the
 * night over the three arches; phones: one row that swipes (scroll snap, no JavaScript). Server-drawn; the only client
 * part is the flight. Loops move transform and opacity only, pause off screen (`data-album`, motion.tsx) and stop with
 * reduced motion.
 */

const BULBS = 17;

function StringLights(): React.JSX.Element {
  // the wire is a quadratic curve; a bulb at t sits on it at 4·sag·t(1−t)
  return (
    <div className="dw-lights" aria-hidden="true">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M0 0 Q50 20 100 0" vectorEffect="non-scaling-stroke" />
      </svg>
      {Array.from({ length: BULBS }, (_, i) => {
        const t = (i + 0.5) / BULBS;
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

export function DiwaliWindows({ free }: { free: string | null }): React.JSX.Element {
  return (
    <section aria-label="Diwali at IWC" className="dw" data-album="">
      <div className="dw-toran" aria-hidden="true" />
      <div className="dw-row">
        <div className="dw-wide">
          {/* D-175: the founder's photo on the night's right, fading into it */}
          <VisualSlot id={WIDE.slot} className="dw-photo dw-photo--night" />
          <StringLights />
          <Burst className="dw-burst--a" />
          <Burst className="dw-burst--b" />
          <div className="dw-wide-words">
            {WIDE.day ? <p className="dw-kicker font-ui">Diwali · {dayDate(WIDE.day)}</p> : null}
            <h2 className="font-heading text-[clamp(26px,2.5vw,40px)] font-medium leading-[1.05] tracking-[-0.025em]">
              {WIDE.hook}
            </h2>
            <Link href={WIDE.href} prefetch={false} className="dw-go dw-go--night font-ui">
              {WIDE.cta}
              <Arrow />
            </Link>
          </div>
          <div className="dw-sky">
            <Flight free={free} festival="any" compact />
          </div>
        </div>

        {ARCHES.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            prefetch={false}
            className={`dw-arch dw-arch--${a.tone}${slotShown(a.slot) ? ' dw-arch--photo' : ''}`}
          >
            <span className="dw-arch-shape">
              {/* D-175: the founder's photo fills the arch's top (the view through the window); else the drawing */}
              <VisualSlot id={a.slot} className="dw-photo" />
              <ArchLine />
              <span className="dw-kicker font-ui">{a.kicker}</span>
              {slotShown(a.slot) ? null : <WindowArt art={a.art} />}
              {a.lead ? (
                <span className="dw-hook">
                  <span className="dw-lead font-ui">{a.lead}</span>
                  <span className="dw-big font-heading">{a.big}</span>
                </span>
              ) : (
                <span className="dw-hook dw-hook--words font-heading">{a.big}</span>
              )}
              {a.tag ? <span className="dw-tag font-ui">{a.tag}</span> : null}
              {/* D-176: the button is the arch's own link, drawn; the whole window stays the target */}
              <span className="dw-go font-ui">
                {a.cta}
                <Arrow />
              </span>
              <Diya />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
