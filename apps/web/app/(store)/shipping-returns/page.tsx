import { InfoPage } from '@/features/info/info-page';
import { ShippingReturnsText } from '@/features/info/shipping-returns';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Shipping & returns' };

/** The page itself (a direct visit or a search engine); from any store page the same text opens in the glass panel (D-092). */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Shipping & returns">
      <ShippingReturnsText />
    </InfoPage>
  );
}
