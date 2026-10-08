import { supportEmail } from '@/lib/env';


/** The support address comes from NEXT_PUBLIC_CONTACT_EMAIL. TODO(founder): Q-9 (domain + support email). */
export function ContactText(): React.JSX.Element {
  const email = supportEmail();
  return (
    <>
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
    </>
  );
}
