import { CartView } from '@/features/cart/cart-view';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

/** Static shell; the bag itself lives on the device. */
export default function CartPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Your bag</h1>
      <CartView />
    </div>
  );
}
