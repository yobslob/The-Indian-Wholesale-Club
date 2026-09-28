import { InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How it works' };

// TODO(founder): approve this copy (draft, D-019). It speaks as the seller and never about operations (D-003).
export default function HowItWorksPage(): React.JSX.Element {
  return (
    <InfoPage title="How it works">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Pick your state, or any state you miss.</li>
        <li>Choose its clothing and spices.</li>
        <li>Before you pay, you see the estimated delivery window for your order.</li>
        <li>We deliver to your door in the US and keep you updated until it arrives.</li>
      </ol>
    </InfoPage>
  );
}
