import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'FAQ' };

// TODO(founder): FAQ answers depend on Q-3 (carrier) and Q-5 (returns); shipping is D-041, refunds D-042.
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="FAQ">
      <ComingSoon />
    </InfoPage>
  );
}
