import { FaqText } from '@/features/info/faq';
import { InfoPanel } from '@/features/info/info-panel';

/** FAQ opened from a store page: the glass panel over that page (D-092). */
export default function FaqPanel(): React.JSX.Element {
  return (
    <InfoPanel title="FAQ">
      <FaqText />
    </InfoPanel>
  );
}
