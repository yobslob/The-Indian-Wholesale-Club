import Link from 'next/link';

import { dayDate } from '@repo/shared/domain';

import { Money } from '@/features/shell/market';
import { Flight } from '@/features/visuals/flight';
import { VisualSlot, slotShown } from '@/features/visuals/visual-slot';

import { Arrow, ArchLine, Leaf, Pumpkin, WindowArt } from './homecoming-art';
import { ARCHES, SEASON, WIDE, type Tone } from './homecoming-hooks';

/**
 * Home's windows, dressed for the season: Homecoming, for Thanksgiving (D-196; built for Diwali, founder 2026-10-31,
 * D-174: "convert this into an ad/banner types component … arch windows for each category … show this airplane flying
 * inside somewhere the card"). A row of arch windows, the doors of home, under a garland of autumn leaves, one per
 * hook (homecoming-hooks.ts), each with its drawing and a pumpkin on the sill. The wide one is a dusk: a garland of
 * leaves along its top, two leaves drifting down and the flight crossing it with its banner (the free line,
 * flight.tsx): home, on its way over. At every width the arches sit in a row (founder 2026-11-02, D-177: no sliding).
 * D-179: Home shows the arches under the hero and the dusk after the album, as separate sections. Server-drawn; the
 * only client part is the flight. Loops move transform and opacity only, pause off screen (`data-album`, motion.tsx)
 * and stop with reduced motion.
 */

const LEAVES = 17;

// written out in full: Tailwind keeps a components-layer rule only when its class appears whole in the source, so a
// built `hc-arch--${tone}` left the windows without their colours
const TONE: Record<Tone, string> = {
  pumpkin: 'hc-arch--pumpkin',
  olive: 'hc-arch--olive',
  paper: 'hc-arch--paper',
};

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

/** The three arch windows under their toran: Clothing, Snacks and the neighbourhood's shelves (D-174 – D-176). */
export function HomecomingArches(): React.JSX.Element {
  return (
    <section aria-label={SEASON.arches} className="hc" data-album="">
      <div className="hc-bunting" aria-hidden="true" />
      <div className="hc-row">
        {ARCHES.map((a) => (
          <Link
            key={a.id}
            href={a.href}
            prefetch={false}
            className={`hc-arch ${TONE[a.tone]}${slotShown(a.slot) ? ' hc-arch--photo' : ''}`}
          >
            <span className="hc-arch-shape">
              {/* D-175: the founder's photo fills the arch's top (the view through the window); else the drawing */}
              <VisualSlot id={a.slot} className="hc-photo" />
              <ArchLine />
              <span className="hc-kicker font-ui">{a.kicker}</span>
              {slotShown(a.slot) ? null : <WindowArt art={a.art} />}
              {a.lead ? (
                <span className="hc-hook">
                  <span className="hc-lead font-ui">{a.lead}</span>
                  <span className="hc-big font-heading">{a.cents !== undefined ? <Money cents={a.cents} /> : a.big}</span>
                </span>
              ) : (
                <span className="hc-hook hc-hook--words font-heading">{a.big}</span>
              )}
              {a.tag ? <span className="hc-tag font-ui">{a.tag}</span> : null}
              {/* D-176: the button is the arch's own link, drawn; the whole window stays the target */}
              <span className="hc-go font-ui">
                {a.cta}
                <Arrow />
              </span>
              <Pumpkin />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
