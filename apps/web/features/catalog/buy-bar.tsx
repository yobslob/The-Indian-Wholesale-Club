'use client';

import { useEffect, useState } from 'react';

/** The bar's height on a phone (its button 48 px and padding), so the page's button counts as seen only above it. */
const BAR_PX = 76;

/**
 * Phones only (D-082): a bar with the name, price · option and Add to bag that slides up from the bottom whenever the
 * page's own Add to bag is off the screen, and slides back down when it is in view. Launch QA B-2: on a phone the
 * button starts below the fold (its top at 827 px on an 812 px screen), so the bar shows from the first screen, not
 * only once the button has scrolled away above it. It adds the same piece and quantity as the button it stands in for,
 * and says what that button says ("Choose a size" until one is picked). One IntersectionObserver, no scroll listener.
 */
export function BuyBar({
  target,
  name,
  detail,
  action,
  disabled,
  added,
  onAdd,
}: {
  target: React.RefObject<HTMLElement | null>;
  name: string;
  detail: string;
  /** The page button's words: "Add to bag", or "Choose a size" before a pick (D-140, L3). */
  action: string;
  disabled: boolean;
  /** The page's "Added" line is off screen while the bar shows, so the bar's button says it. */
  added: boolean;
  /** Called with the bar's button, where the add-to-bag flight starts (D-116). */
  onAdd: (from: Element) => void;
}): React.JSX.Element {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = target.current;
    if (!el) return;
    // The sticky header covers the top (--top-h) and the bar itself the bottom: a button hidden under either is off
    // the screen for the customer.
    const top = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 0;
    const io = new IntersectionObserver(([e]) => setShown(e ? !e.isIntersecting : false), {
      rootMargin: `-${Math.round(top)}px 0px -${BAR_PX}px 0px`,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [target]);
  // The free-delivery bar (D-111) rides above this bar on phones while it shows.
  useEffect(() => {
    if (shown) document.documentElement.dataset.buyBar = '';
    else delete document.documentElement.dataset.buyBar;
    return () => {
      delete document.documentElement.dataset.buyBar;
    };
  }, [shown]);

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
        <span className="text-ink-muted block truncate text-[13px]">{detail}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => onAdd(e.currentTarget)}
        className="bg-brand text-on-brand font-ui press h-12 w-[150px] flex-none rounded-pill text-[15px] font-medium disabled:opacity-50"
      >
        {added ? '✓ Added' : action}
      </button>
    </div>
  );
}
