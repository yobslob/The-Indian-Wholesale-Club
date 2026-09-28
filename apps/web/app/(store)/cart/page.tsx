import { CartView } from '@/features/cart/cart-view';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

/** Static shell; the bag itself lives on the device. */
export default function CartPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Your bag</h1>
      <CartView />
    </div>
  );
}
