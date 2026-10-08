'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { BagLines } from './bag-lines';
import { checkoutButton, EmptyLine, Subtotal } from './cart-view';
import { cartCount, useCart } from './store';

/**
 * The bag as a side panel (D-086), opened by the header's bag icon, in and out with the menu's motion (D-079,
 * globals.css .site-panel): "Your bag (n)", the lines, the subtotal, Checkout and View bag. Escape, ×, a tap on the
 * dimmed page or going to another page close it.
 */
export function BagPanel({ open, onClose }: { open: boolean; onClose: (refocus: boolean) => void }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const path = usePathname();
  const close = useRef<HTMLButtonElement>(null);
  const count = cartCount(lines);

  useEffect(() => onClose(false), [path, onClose]);
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
        <div className="flex-1 overflow-y-auto px-5" data-lenis-prevent>
          {lines.length > 0 ? (
            <BagLines compact />
          ) : (
            <div className="py-6">
              <EmptyLine />
            </div>
          )}
        </div>
        {lines.length > 0 ? (
          <footer className="border-line grid gap-3 border-t px-5 pb-5 pt-4">
            <Subtotal />
            <Link href="/checkout" className={`${checkoutButton} w-full px-0`}>
              Checkout
            </Link>
            <Link href="/cart" className="justify-self-center text-sm font-medium underline underline-offset-[3px]">
              View bag
            </Link>
          </footer>
        ) : null}
      </aside>
    </>
  );
}
