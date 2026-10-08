'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { BagPanel } from './bag-panel';
import { cartCount, useCart } from './store';

/**
 * Header bag icon with the number of pieces as a brand-colour pill (D-079). A click opens the bag panel (D-086); it
 * stays a real link to /cart, so a new tab, a modifier click or no JavaScript still reach the bag page. The count
 * appears after hydration (the bag is on-device).
 */
export function CartLink(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(lines) : 0;
  const onClose = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) link.current?.focus();
  }, []);

  return (
    <>
      <Link
        ref={link}
        href="/cart"
        className="site-icon"
        aria-label={count > 0 ? `Bag, ${count} ${count === 1 ? 'piece' : 'pieces'}` : 'Bag'}
        aria-controls="bag-panel"
        aria-expanded={open}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        <HeaderIcon name="bag" />
        {count > 0 ? <span className="site-count">{count}</span> : null}
      </Link>
      {mounted ? <BagPanel open={open} onClose={onClose} /> : null}
    </>
  );
}
