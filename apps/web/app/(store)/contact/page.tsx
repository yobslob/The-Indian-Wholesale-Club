import { ContactText } from '@/features/info/contact';
import { InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact' };

/** The page itself (a direct visit or a search engine); from any store page the same text opens in the glass panel (D-092). */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Contact">
      <ContactText />
    </InfoPage>
  );
}
