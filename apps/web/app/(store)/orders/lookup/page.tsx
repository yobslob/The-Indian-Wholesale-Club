import { LookupForm } from '@/features/orders/lookup-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default function OrderLookupPage(): React.JSX.Element {
  return <LookupForm title="Track your order" />;
}
