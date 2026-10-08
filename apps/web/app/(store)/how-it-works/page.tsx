import { HowItWorksText } from '@/features/info/how-it-works';
import { InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'How it works' };

/** The page itself (a direct visit or a search engine); from any store page the same text opens in the glass panel (D-092). */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="How it works">
      <HowItWorksText />
    </InfoPage>
  );
}
