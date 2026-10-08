import { InfoPanel } from '@/features/info/info-panel';
import { TermsText } from '@/features/info/terms';

/** Terms opened from a store page: the glass panel over that page (D-092). */
export default function TermsPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Terms">
      <TermsText />
    </InfoPanel>
  );
}
