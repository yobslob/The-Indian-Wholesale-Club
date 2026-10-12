import { InfoPanel } from '@/features/info/info-panel';
import { TermsText } from '@/features/info/terms';

// Rendered on request: Vercel's 5-minute re-render of a cached intercepted route answered 404, so after the first
// five minutes every info link fell back to a full page load instead of the panel (found 2026-10-12, D-116).
export const dynamic = 'force-dynamic';

/** Terms opened from a store page: the glass panel over that page (D-092). */
export default function TermsPanel(): React.JSX.Element {
  return (
    <InfoPanel title="Terms">
      <TermsText />
    </InfoPanel>
  );
}
