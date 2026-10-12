import { InfoPanel } from '@/features/info/info-panel';
import { ShippingReturnsText } from '@/features/info/shipping-returns';

// Rendered on request: Vercel's 5-minute re-render of a cached intercepted route answered 404, so after the first
// five minutes every info link fell back to a full page load instead of the panel (found 2026-10-12, D-116).
export const dynamic = 'force-dynamic';

/** Shipping & returns opened from a store page: the glass panel over that page (D-092). */
export default function ShippingReturnsPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Shipping & returns">
      <ShippingReturnsText />
    </InfoPanel>
  );
}
