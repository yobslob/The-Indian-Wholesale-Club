import { LookupForm } from '@/features/orders/lookup-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Track your order', robots: { index: false } };

export default function OrderLookupPage(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Track your order</h1>
      <LookupForm />
    </div>
  );
}
