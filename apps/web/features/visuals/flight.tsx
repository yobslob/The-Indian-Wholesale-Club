import { FlightArt } from './flight-art';
import { US_MAP } from './us-map';

/**
 * The flight (founder 2026-10-30: "a plane flying from india to us carrying a banner of diwali or free delivery on
 * 49.99"; then "make it smaller the path to be straight, instead of a hut make US border outlined in states"): a small
 * band, India's gold outline on the left, the US with its states on the right, a straight dashed line between them,
 * and a side-view plane crossing it at a steady speed towing a cloth banner (flight-art.tsx). The banner says the
 * free-delivery line (from the store's policy) or, while a festival is near and an order can still make it, "For
 * Diwali, order by Oct 31" (festivalClock, D-161: never a promise it cannot keep). The US map rides in the page once as
 * a symbol, drawn on the server, never in the JavaScript; no image, no request.
 */
export function Flight({
  free,
  festival,
}: {
  free: string | null;
  festival: 'quick' | 'any';
}): React.JSX.Element {
  return (
    <section aria-label="From India to your door" className="flight-band">
      <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
        <symbol id="us-map" viewBox={US_MAP.viewBox}>
          <path d={US_MAP.states} className="flight-us-states" vectorEffect="non-scaling-stroke" />
          <path d={US_MAP.border} className="flight-us-border" vectorEffect="non-scaling-stroke" />
        </symbol>
      </svg>
      <FlightArt free={free} festival={festival} />
    </section>
  );
}
