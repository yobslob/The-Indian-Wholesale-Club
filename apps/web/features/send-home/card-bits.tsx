/** D-205's chip and thread looks, shared by the bag's card (D-208 keeps them: "all the existing designs stay"). */
export const chip = 'font-ui grid place-items-center rounded-[12px] border text-[14px] font-semibold leading-none';
export const picked = 'border-brand bg-canvas border-[1.5px] text-ink';
export const unpicked = 'border-line bg-paper text-ink';

/** The gold thread sewn from the dollars to the rupees (CSS `gift-sew`, still with reduced motion). */
export function Thread(): React.JSX.Element {
  return (
    <svg viewBox="0 0 52 20" width="48" height="18" aria-hidden="true" className="text-gift-thread shrink-0">
      <path d="M2 15 C 14 2, 34 2, 46 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="gift-sew" />
      <path d="M41 9 L47 14 L40 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
