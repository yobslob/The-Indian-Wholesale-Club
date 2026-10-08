'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { HeaderIcon } from '@/features/shell/header-icons';

import { cartCount, useCart } from './store';

/** Header bag icon with the number of pieces as a brand-colour pill (D-079). The count appears after hydration (the bag is on-device). */
export function CartLink(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(lines) : 0;
  return (
    <Link href="/cart" className="site-icon" aria-label={count > 0 ? `Bag, ${count} ${count === 1 ? 'piece' : 'pieces'}` : 'Bag'}>
      <HeaderIcon name="bag" />
      {count > 0 ? <span className="site-count">{count}</span> : null}
    </Link>
  );
}
