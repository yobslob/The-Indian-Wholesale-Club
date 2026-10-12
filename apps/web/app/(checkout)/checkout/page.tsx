import { CheckoutFlow } from '@/features/checkout/checkout-flow';
import { savedCheckoutDetails } from '@/features/checkout/saved-details';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

/**
 * Dynamic by nature (payment); a client flow (storefront.md) in the quiet frame (D-087). For a signed-in customer the
 * server reads their email and saved addresses first, so the steps open filled in (D-114).
 */
export default async function CheckoutPage(): Promise<React.JSX.Element> {
  const saved = await savedCheckoutDetails();
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-[clamp(32px,3vw,52px)] text-[#1D1A17] font-medium leading-tight tracking-[-0.03em]">Checkout</h1>
      <CheckoutFlow saved={saved} />
    </div>
  );
}
