import { AboutText } from '@/features/info/about';
import { InfoPanel } from '@/features/info/info-panel';

/** About us opened from a store page: the glass panel over that page (D-092). */
export default function AboutPanel(): React.JSX.Element {
  return (
    <InfoPanel title="About us">
      <AboutText />
    </InfoPanel>
  );
}
