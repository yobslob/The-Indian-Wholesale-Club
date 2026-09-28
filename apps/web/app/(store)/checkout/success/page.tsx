import { CheckoutSuccess } from '@/features/checkout/checkout-success';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };

type SearchParams = Promise<{ order?: string; payment_intent?: string }>;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  return (
    <CheckoutSuccess
      orderNumber={params.order ?? null}
      paymentIntentId={params.payment_intent ?? null}
    />
  );
}
