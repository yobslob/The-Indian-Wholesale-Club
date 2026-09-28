import { CheckoutFlow } from '@/features/checkout/checkout-flow';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

/** Dynamic by nature (payment); the page itself is a client flow (storefront.md). */
export default function CheckoutPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Checkout</h1>
      <CheckoutFlow />
    </div>
  );
}
