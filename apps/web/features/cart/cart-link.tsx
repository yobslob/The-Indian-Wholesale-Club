'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { cartCount, useCart } from './store';

/** Header cart link. The count appears after hydration (the cart is on-device). */
export function CartLink(): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const count = mounted ? cartCount(lines) : 0;
  return (
    <Link href="/cart" className="hover:underline">
      Bag{count > 0 ? ` (${count})` : ''}
    </Link>
  );
}
