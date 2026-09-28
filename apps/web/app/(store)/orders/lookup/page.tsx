import { LookupForm } from '@/features/orders/lookup-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default function OrderLookupPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Track your order</h1>
      <LookupForm />
    </div>
  );
}
