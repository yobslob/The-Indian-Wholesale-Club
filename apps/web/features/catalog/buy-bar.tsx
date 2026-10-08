'use client';

import { useEffect, useState } from 'react';

/**
 * Phones only (D-082): a bar with the name, price · option and Add to bag that slides up from the bottom once the
 * page's own Add to bag has scrolled away above the screen, and slides back down when it returns. It adds the same
 * piece and quantity as the button it stands in for.
 */
export function BuyBar({
  target,
  name,
  detail,
  disabled,
  added,
  onAdd,
}: {
  target: React.RefObject<HTMLElement | null>;
  name: string;
  detail: string;
  disabled: boolean;
  /** The page's "Added" line is off screen while the bar shows, so the bar's button says it. */
  added: boolean;
  onAdd: () => void;
}): React.JSX.Element {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    // The root reaches far below the screen, so "not intersecting" means "scrolled away above it", and a jump from
    // above the screen to below it (Home key, a jump link) still counts as a change.
    const io = new IntersectionObserver(([e]) => setShown(e ? !e.isIntersecting : false), {
      rootMargin: '0px 0px 100000px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={`bg-canvas border-line fixed inset-x-0 bottom-0 z-[45] flex items-center gap-3 border-t px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-2.5 transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)] md:hidden ${
        shown ? 'translate-y-0' : 'translate-y-[105%]'
      }`}
    >
      <div className="font-ui min-w-0 flex-1">
        <b className="block truncate text-sm font-semibold">{name}</b>
        <span className="text-ink-muted text-[13px]">{detail}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="bg-brand text-on-brand font-ui h-12 w-[150px] flex-none rounded-pill text-[15px] font-medium disabled:opacity-50"
      >
        {added ? '✓ Added' : 'Add to bag'}
      </button>
    </div>
  );
}
