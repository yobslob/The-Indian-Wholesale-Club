import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shipping & returns' };

// TODO(founder): Q-5 (returns/exchanges policy). Shipping: standard free / express $8 (D-041), express days Q-18. No returns flow (D-028).
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Shipping & returns">
      <ComingSoon />
    </InfoPage>
  );
}
