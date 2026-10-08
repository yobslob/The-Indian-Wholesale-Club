import { HowItWorksText } from '@/features/info/how-it-works';
import { InfoPanel } from '@/features/info/info-panel';

/** How it works opened from a store page: the glass panel over that page (D-092). */
export default function HowItWorksPanel(): React.JSX.Element {
  return (
    <InfoPanel title="How it works">
      <HowItWorksText />
    </InfoPanel>
  );
}
