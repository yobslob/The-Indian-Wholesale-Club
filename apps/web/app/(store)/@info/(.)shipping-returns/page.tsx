import { InfoPanel } from '@/features/info/info-panel';
import { ShippingReturnsText } from '@/features/info/shipping-returns';

/** Shipping & returns opened from a store page: the glass panel over that page (D-092). */
export default function ShippingReturnsPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Shipping & returns">
      <ShippingReturnsText />
    </InfoPanel>
  );
}
