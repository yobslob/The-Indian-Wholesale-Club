import { DUTIES_PAID } from '@repo/shared/domain';

/**
 * "Duties paid. Nothing to pay at your door." (the homesick plan's decision 3, D-161) as a small rubber stamp in the
 * product page's delivery box: the words round its ring like the postmarks on Pick your home's stamps (D-080), a
 * house in the middle, pressed on once as the page opens (`.duties-stamp`, globals.css; still with reduced motion).
 * The sentence itself is in the box's text for screen readers; the stamp is decoration.
 */
export function DutiesStamp(): React.JSX.Element | null {
  if (!DUTIES_PAID) return null;
  return (
    <svg viewBox="0 0 100 100" className="duties-stamp" aria-hidden="true" focusable="false">
      <defs>
        <path id="duties-ring" d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0" />
      </defs>
      <circle cx="50" cy="50" r="47" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
      <text fontSize="10.5" fontWeight="700" letterSpacing="1.6" fill="currentColor">
        <textPath href="#duties-ring">DUTIES PAID · NOTHING AT YOUR DOOR ·</textPath>
      </text>
      <path
        d="M38 54 L50 43 L62 54 M42 51 V62 H58 V51 M47.5 62 V56 H52.5 V62"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
