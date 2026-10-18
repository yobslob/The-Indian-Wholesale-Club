import { INDIA_MARK } from '@repo/shared/india-map/mark';

/**
 * The brand's running stitch (D-140, plan F7): a dashed line like thread that sews itself from a small India to the
 * customer's US state and ends in the stitched check (as the checkout steps' check, step.tsx). About 1.4 s, once;
 * everything around it is there from the first frame. CSS only (stroke-dashoffset); with reduced motion it simply
 * shows finished (globals.css turns every animation off).
 */
export function OrderStitch({ state }: { state: string | null }): React.JSX.Element {
  return (
    <svg viewBox="0 0 320 120" role="img" aria-label={`From India to ${state ?? 'your door'}`} className="order-stitch h-auto w-full max-w-[420px]">
      <g transform="translate(14 18) scale(0.078)" className="text-brand">
        <path d={INDIA_MARK.path} fill="none" stroke="currentColor" strokeWidth={22} />
      </g>
      <defs>
        {/* the thread is dashed; a solid line drawn underneath as a mask reveals it stitch by stitch */}
        <mask id="order-stitch-thread" maskUnits="userSpaceOnUse">
          <path className="stitch-reveal" d="M58 62 C 120 0, 190 0, 250 52" fill="none" stroke="#fff" strokeWidth="8" pathLength={100} />
        </mask>
      </defs>
      <path
        className="text-brand"
        d="M58 62 C 120 0, 190 0, 250 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="7 6"
        mask="url(#order-stitch-thread)"
      />
      <circle cx="268" cy="62" r="22" className="stitch-dot fill-paper stroke-line" strokeWidth="1.5" />
      <path className="stitch-check text-positive" d="M258 63l7 7 13-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" pathLength={100} />
      {state ? (
        <text x="268" y="104" textAnchor="middle" className="fill-ink-muted font-ui text-[12px] font-semibold">
          {state}
        </text>
      ) : null}
    </svg>
  );
}

/** The same stitch as a small running line while something is on its way (confirming a payment). */
export function StitchRunning({ label }: { label: string }): React.JSX.Element {
  return (
    <p className="font-ui text-ink flex items-center gap-3" role="status">
      <svg viewBox="0 0 80 8" aria-hidden="true" className="stitch-running text-brand h-2 w-20">
        <line x1="2" y1="4" x2="78" y2="4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      {label}
    </p>
  );
}
