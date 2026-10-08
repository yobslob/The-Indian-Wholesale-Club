import { CheckoutFlow } from '@/features/checkout/checkout-flow';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

/** Dynamic by nature (payment); the page itself is a client flow (storefront.md), in the quiet frame (D-087). */
export default function CheckoutPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-[clamp(32px,3vw,52px)] text-[#1D1A17] font-medium leading-tight tracking-[-0.03em]">Checkout</h1>
      <CheckoutFlow />
    </div>
  );
}
