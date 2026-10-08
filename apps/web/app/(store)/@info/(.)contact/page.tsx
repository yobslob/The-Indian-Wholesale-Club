import { ContactText } from '@/features/info/contact';
import { InfoPanel } from '@/features/info/info-panel';

/** Contact opened from a store page: the glass panel over that page (D-092). */
export default function ContactPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Contact">
      <ContactText />
    </InfoPanel>
  );
}
