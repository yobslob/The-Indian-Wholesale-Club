import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shipping & returns' };

// TODO(founder): Q-5 (returns/exchanges policy) and Q-16 (shipping charge). No returns flow until then (D-028).
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Shipping & returns">
      <ComingSoon />
    </InfoPage>
  );
}
