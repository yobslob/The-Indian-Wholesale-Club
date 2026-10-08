import { InfoPage } from '@/features/info/info-page';
import { PrivacyText } from '@/features/info/privacy';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

/** The page itself (a direct visit or a search engine); from any store page the same text opens in the glass panel (D-092). */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Privacy">
      <PrivacyText />
    </InfoPage>
  );
}
