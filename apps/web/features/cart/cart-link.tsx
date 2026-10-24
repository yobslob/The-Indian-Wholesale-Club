'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { cartCount, useCart } from './store';

// The panel (its lines, charges and shipments) is fetched the moment a finger or pointer reaches the icon, not with
// every page: it kept every page's first-load JS over its 150 KB budget (D-011, check.mjs http).
const loadPanel = () => import('./bag-panel');
const BagPanel = dynamic(() => loadPanel().then((m) => m.BagPanel), { ssr: false });

/**
 * Header bag icon with the number of pieces as a brand-colour pill (D-079). A click opens the bag panel (D-086); it
 * stays a real link to /cart, so a new tab, a modifier click or no JavaScript still reach the bag page. The count
 * appears after hydration (the bag is on-device).
 */
export function CartLink(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  // Mounted from the first sign of intent (hover, focus, touch), so it is there, closed, before the tap opens it
  const [wanted, setWanted] = useState(false);
  const want = useCallback(() => {
    setWanted(true);
    void loadPanel();
  }, []);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(lines) : 0;
  // The count pops when the bag grows (D-116), not when it first appears after hydration.
  const seen = useRef<number | null>(null);
  const [pop, setPop] = useState(0);
  useEffect(() => {
    if (!mounted) return;
    if (seen.current !== null && count > seen.current) setPop((n) => n + 1);
    seen.current = count;
  }, [mounted, count]);
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
        onPointerEnter={want}
        onPointerDown={want}
        onFocus={want}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setWanted(true);
          setOpen(true);
        }}
      >
        <HeaderIcon name="bag" />
        {count > 0 ? (
          <span key={pop} className="site-count" data-pop={pop > 0 || undefined}>
            {count}
          </span>
        ) : null}
      </Link>
      {mounted && wanted ? <BagPanel open={open} onClose={onClose} /> : null}
    </>
  );
}
