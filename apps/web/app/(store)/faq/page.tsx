import { FaqText } from '@/features/info/faq';
import { InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'FAQ' };

/** The page itself (a direct visit or a search engine); from any store page the same text opens in the glass panel (D-092). */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="FAQ">
      <FaqText />
    </InfoPage>
  );
}
