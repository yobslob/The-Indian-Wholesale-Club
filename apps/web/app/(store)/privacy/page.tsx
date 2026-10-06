import { InfoPage } from '@/features/info/info-page';
import { supportEmail } from '@/lib/env';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy' };

/**
 * Privacy. A DRAFT written by Claude from what the code actually does (checked 2026-10-06: Supabase accounts and
 * orders, Stripe payments, Resend emails, the bag in the browser, a keyed hash of the IP address for rate limits,
 * searches recorded without who searched, no analytics or advertising trackers). Keep it true when any of that changes.
 * TODO(founder): approve with a lawyer; how long records are kept (B-23) and the company contact details (Q-9).
 */
export default function Page(): React.JSX.Element {
  const email = supportEmail();
  return (
    <InfoPage title="Privacy">
      <p>
        The Indian Wholesale Club is a New Jersey business. This page says what we collect when you shop with us, why,
        and who else sees it.
      </p>

      <h2 className="font-medium">What we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Your order</strong>: your email, name, delivery address and what you bought. If you make an account, also
          your saved addresses, saved items and, if you add one, your phone number.
        </li>
        <li>
          <strong>Payment</strong>: handled by Stripe. We never see or store your full card number.
        </li>
        <li>
          <strong>Reviews</strong>: what you write, the name you choose to show and any photos you add. Nothing appears
          before we approve it.
        </li>
        <li>
          <strong>Searches</strong>: the words searched on the site and how many results they found, without who searched,
          so we know what to stock.
        </li>
        <li>
          <strong>Protection against abuse</strong>: a scrambled form of your internet address (never the address
          itself), counted for a minute to stop too many requests in a row and cleared out after about an hour.
        </li>
      </ul>

      <h2 className="font-medium">In your browser</h2>
      <p>
        Your bag is kept in your own browser until you check out. If you sign in, a cookie keeps you signed in. We use no
        advertising or analytics trackers.
      </p>

      <h2 className="font-medium">Why we use it</h2>
      <p>
        To take your payment, deliver your order, email you about it, handle cancels, returns and refunds, answer you
        when you write to us, and keep the site safe. We do not sell your information.
      </p>

      <h2 className="font-medium">Who else sees it</h2>
      <p>
        Only the companies that help us run the shop, for that job: Stripe (payments), Supabase (our database), Vercel
        (the website), Resend (our emails) and the couriers who deliver your order or collect a return, who get your
        name, address and phone number if you gave one.
      </p>

      <h2 className="font-medium">Your choices</h2>
      <p>
        You can ask us what we hold about you, to correct it, or to delete it, except what the law requires us to keep
        about orders and payments.
        {email ? (
          <>
            {' '}
            Write to{' '}
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
            .
          </>
        ) : null}
      </p>
    </InfoPage>
  );
}
