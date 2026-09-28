import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms' };

// TODO(founder): terms of sale (legal, needs founder/lawyer input).
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Terms">
      <ComingSoon />
    </InfoPage>
  );
}
