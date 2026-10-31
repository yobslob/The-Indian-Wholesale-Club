import type { Art } from './diwali-hooks';

/**
 * The Diwali windows' small drawings (diwali-windows.tsx): line art in the window's ink, no images, no requests. The
 * arch is one shape (ARCH, a pointed Mughal arch on a 100 × 133 box) used as the window's mask and, inset, as its
 * gold inner line.
 */

/** The window's outline; also in globals.css as the mask (keep the two the same). */
export const ARCH_INNER =
  'M6 127 V48 C6 31 22 22 36 18.5 C45 16 48.5 12 50 8 C51.5 12 55 16 64 18.5 C78 22 94 31 94 48 V127 Z';

export function ArchLine(): React.JSX.Element {
  return (
    <svg
      className="dw-arch-line"
      viewBox="0 0 100 133"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={ARCH_INNER} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** The buttons' arrow, in a hairline ring that fills on hover (D-176). */
export function Arrow(): React.JSX.Element {
  return (
    <span className="dw-go-ring" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />
      </svg>
    </span>
  );
}

/** A clay diya on the window's sill, its flame flickering (transform and opacity only). */
export function Diya(): React.JSX.Element {
  return (
    <svg className="dw-diya" viewBox="0 0 40 30" aria-hidden="true">
      <path className="dw-diya-flame" d="M20 1 C24.5 7.5 25 12 20 16 C15 12 15.5 7.5 20 1 Z" />
      <path className="dw-diya-bowl" d="M3 17 Q20 33 37 17 Q31 15 20 15 Q9 15 3 17 Z" />
      <path className="dw-diya-lip" d="M3 17 Q20 21 37 17" />
    </svg>
  );
}

function Kurta(): React.JSX.Element {
  return (
    <svg className="dw-art" viewBox="0 0 64 64" aria-hidden="true">
      {/* the hanger */}
      <path d="M29.5 9 c0-3 5-3 5 0 c0 2.4-2.5 2.6-2.5 5 M32 14 L16 21 H48 Z" />
      {/* a straight kurta: shoulders, sleeves, side slits, the placket */}
      <path d="M22 21 L13 26 L9 40 L15 41.5 L19 31 V58 H45 V31 L49 41.5 L55 40 L51 26 L42 21 C39 25 25 25 22 21 Z" />
      <path d="M32 24 V36 M19 50 V58 M45 50 V58" />
      <path className="dw-dots" d="M30 28h.1M30 32h.1" />
    </svg>
  );
}

function Cone(): React.JSX.Element {
  return (
    <svg className="dw-art" viewBox="0 0 64 64" aria-hidden="true">
      {/* a newspaper cone of bhel, the bits spilling over */}
      <path d="M14 22 L32 60 L50 22 Z" />
      <path d="M19 32 L41 26 M22 39 L39 34 M26 47 L36 43" />
      <path
        className="dw-dots"
        d="M18 18h.1M24 14h.1M30 17h.1M36 12h.1M42 16h.1M47 19h.1M27 9h.1M39 7h.1"
      />
    </svg>
  );
}

function India(): React.JSX.Element {
  return (
    <svg className="dw-art dw-art--map" viewBox="0 0 64 64" aria-hidden="true">
      <use href="#india-outline" x="6" y="2" width="52" height="60" />
      {/* a few homes lit up */}
      <circle className="dw-pin" cx="24" cy="18" r="2.2" />
      <circle className="dw-pin" cx="21" cy="34" r="2.2" style={{ animationDelay: '0.7s' }} />
      <circle className="dw-pin" cx="33" cy="47" r="2.2" style={{ animationDelay: '1.4s' }} />
      <circle className="dw-pin" cx="44" cy="30" r="2.2" style={{ animationDelay: '2.1s' }} />
    </svg>
  );
}

export function WindowArt({ art }: { art: Art }): React.JSX.Element {
  if (art === 'kurta') return <Kurta />;
  if (art === 'cone') return <Cone />;
  return <India />;
}

/** A firework over the wide window: twelve rays that open and fade, again and again. */
export function Burst({ className }: { className: string }): React.JSX.Element {
  const rays = Array.from({ length: 12 }, (_, i) => (i * 30 * Math.PI) / 180);
  return (
    <svg className={`dw-burst ${className}`} viewBox="-20 -20 40 40" aria-hidden="true">
      {rays.map((a) => (
        <path
          key={a}
          d={`M${(Math.cos(a) * 7).toFixed(2)} ${(Math.sin(a) * 7).toFixed(2)} L${(Math.cos(a) * 17).toFixed(2)} ${(Math.sin(a) * 17).toFixed(2)}`}
        />
      ))}
    </svg>
  );
}
