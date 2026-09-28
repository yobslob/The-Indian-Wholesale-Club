import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

// TODO(founder): privacy policy text (legal, needs founder/lawyer input; Q-9 for the company contact details).
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Privacy">
      <ComingSoon />
    </InfoPage>
  );
}
