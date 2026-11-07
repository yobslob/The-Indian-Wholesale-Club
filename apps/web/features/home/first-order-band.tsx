import Link from 'next/link';

import { Burst } from './diwali-art';
import { StringLights } from './diwali-windows';
import { FIRST_ORDER } from './first-order';

/**
 * The first-order band (D-193), between the album and Shop by category: a voucher, green to a gold line, white inside, green
 * words, under the Diwali night's string lights and fireworks. A shagun envelope, the money envelope given at every family
 * occasion, with 10% where its one-rupee coin goes. Server-drawn, no image and no request; the lights and fireworks pause
 * off screen (`data-album`, motion.tsx) and stop with reduced motion.
 */
export function FirstOrderBand(): React.JSX.Element {
  return (
    <section aria-label="Your first order" className="dw fo" data-album="">
      <Link href={FIRST_ORDER.href} prefetch={false} className="fo-band">
        <span className="fo-inner">
          <StringLights />
          <Burst className="dw-burst--a" />
          <Burst className="dw-burst--b" />
          <span className="fo-env" aria-hidden="true">
            <svg viewBox="0 0 96 68">
              <rect width="96" height="68" rx="6" fill="#7a2e23" />
              <path d="M0 5 48 38 96 5" fill="none" stroke="#c9962f" strokeWidth="1.5" />
            </svg>
            <b className="fo-coin font-heading">10%</b>
          </span>
          <span className="fo-words">
            <span className="fo-kick font-ui">{FIRST_ORDER.kicker}</span>
            <span className="fo-head font-heading">{FIRST_ORDER.headline}</span>
          </span>
          <span className="fo-go font-ui">{FIRST_ORDER.cta}</span>
        </span>
      </Link>
    </section>
  );
}
