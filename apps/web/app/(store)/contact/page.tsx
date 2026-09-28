import { InfoPage } from '@/features/info/info-page';
import { supportEmail } from '@/lib/env';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Contact' };

/** The support address comes from NEXT_PUBLIC_CONTACT_EMAIL. TODO(founder): Q-9 (domain + support email). */
export default function ContactPage(): React.JSX.Element {
  const email = supportEmail();
  return (
    <InfoPage title="Contact">
      {email ? (
        <p>
          Write to us at{' '}
          <a href={`mailto:${email}`} className="underline">
            {email}
          </a>
          . Include your order number if you have one.
        </p>
      ) : (
        <p className="text-ink-muted">Contact details are coming soon.</p>
      )}
    </InfoPage>
  );
}
