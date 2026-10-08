import { InfoPanel } from '@/features/info/info-panel';
import { PrivacyText } from '@/features/info/privacy';

/** Privacy opened from a store page: the glass panel over that page (D-092). */
export default function PrivacyPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Privacy">
      <PrivacyText />
    </InfoPanel>
  );
}
