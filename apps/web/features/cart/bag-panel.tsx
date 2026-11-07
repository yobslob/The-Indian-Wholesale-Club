'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { BagLines } from './bag-lines';
import { BagExtras, checkoutButton, EmptyLine, TotalNow } from './cart-view';
import { GoesWellWith } from './goes-well';
import { cartCount, useCart } from './store';
import { useBagBill } from './use-bag-bill';

/**
 * The bag as a side panel (D-086), opened by the header's bag icon, in and out with the menu's motion (D-079,
 * globals.css .site-panel): "Your bag (n)", the lines, the coupons and bill (D-192), the total, Checkout and View bag. Escape, ×, a tap on the
 * dimmed page or going to another page close it.
 */
export function BagPanel({ open, onClose }: { open: boolean; onClose: (refocus: boolean) => void }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const path = usePathname();
  const close = useRef<HTMLButtonElement>(null);
  const count = cartCount(lines);

  // going to another page closes it; not its first draw, which may come with the tap that opens it (cart-link.tsx
  // fetches the panel on that first sign of intent)
  const shownPath = useRef(path);
  useEffect(() => {
    if (shownPath.current === path) return;
    shownPath.current = path;
    onClose(false);
  }, [path, onClose]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div className="site-scrim" data-open={open || undefined} aria-hidden="true" onClick={() => onClose(false)} />
      <aside id="bag-panel" className="site-panel bag-panel font-ui" data-open={open || undefined} aria-label="Your bag">
        <header className="border-line flex items-center justify-between border-b py-2 pl-5 pr-2">
          <h2 className="font-heading m-0 text-[22px] font-medium leading-none text-[#1D1A17]">
            Your bag{count > 0 ? ` (${count})` : ''}
          </h2>
          <button ref={close} type="button" className="site-icon" aria-label="Close bag" onClick={() => onClose(true)}>
            <HeaderIcon name="close" />
          </button>
        </header>
        {lines.length > 0 ? (
          <FilledPanel open={open} onShop={() => onClose(true)} />
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <EmptyLine />
          </div>
        )}
      </aside>
    </>
  );
}

/** D-192: the same goal, coupons and bill as the bag page; the coupons are read once the panel is opened, not on hover. */
function FilledPanel({ open, onShop }: { open: boolean; onShop: () => void }): React.JSX.Element {
  const bag = useBagBill(open);
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
        <BagLines compact />
        <div className="mt-3">
          <BagExtras bag={bag} onShop={onShop} />
        </div>
        {open ? <GoesWellWith /> : null}
      </div>
      <footer className="border-line flex items-center justify-between gap-4 border-t px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        <span className="grid gap-0.5">
          <TotalNow bag={bag} />
          <Link href="/cart" className="text-[13px] font-medium underline underline-offset-[3px]">
            View bag
          </Link>
        </span>
        <Link href="/checkout" className={`${checkoutButton} h-12 px-8`}>
          Checkout
        </Link>
      </footer>
    </>
  );
}
