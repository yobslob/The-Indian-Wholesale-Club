import { ComingSoon, InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'About' };

// TODO(founder): the About story (design.md voice). Claude-written text would be a draft (D-019).
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="About">
      <ComingSoon />
    </InfoPage>
  );
}
