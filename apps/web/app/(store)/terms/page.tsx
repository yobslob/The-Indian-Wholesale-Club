import Link from 'next/link';

import { InfoPage } from '@/features/info/info-page';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms' };

/**
 * Terms of sale. A DRAFT written by Claude that restates the decisions the shop already runs on (D-001, D-004, D-008,
 * D-030, D-036, D-052, D-070 – D-073, D-076); it adds no rule of its own.
 * TODO(founder): approve with a lawyer, who adds what only they can: governing law and disputes, liability limits.
 */
export default function Page(): React.JSX.Element {
  return (
    <InfoPage title="Terms">
      <p>
        These terms apply when you buy from The Indian Wholesale Club, a New Jersey business. We are the seller of
        everything on this site.
      </p>

      <h2 className="font-medium">What we sell</h2>
      <p>
        Clothing and spices made in India. Each product page says which state it comes from; every piece is imported. We
        deliver to addresses in the US only.
      </p>

      <h2 className="font-medium">Prices and payment</h2>
      <p>
        Prices are in US dollars. Shipping and any sales tax are shown at checkout before you pay. Payment is taken when
        you place the order. If a piece sells out while you are paying, we refund you in full and tell you why.
      </p>

      <h2 className="font-medium">Delivery</h2>
      <p>
        Before you pay, you see an estimated delivery window. If it moves later, we email you, and you can keep your order
        with the new date or cancel it for a full refund. If a piece you ordered turns out to be unavailable, we refund it.
      </p>

      <h2 className="font-medium">Cancelling and returns</h2>
      <p>
        You can cancel until your order leaves India, and return pieces after delivery, as set out on{' '}
        <Link href="/shipping-returns" className="underline">
          Shipping &amp; returns
        </Link>
        . Your order page always shows what you would get back before you ask.
      </p>

      <h2 className="font-medium">Reviews</h2>
      <p>
        We read every review before it appears. Only buyers who received the product can add photos.
      </p>

      <h2 className="font-medium">Your account</h2>
      <p>Keep your password to yourself. You can also order without an account and follow the order with its number and email.</p>
    </InfoPage>
  );
}
