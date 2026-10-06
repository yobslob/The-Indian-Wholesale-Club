import Link from 'next/link';

import { getStorePolicyCached } from '@/features/catalog/data';
import { InfoPage } from '@/features/info/info-page';
import { cancelSentence, dayRange, returnTiers, standardShipping, taxSentence } from '@/features/info/policy-text';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'FAQ' };

function Item({ q, children }: { q: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <details className="border-line border-b py-3">
      <summary className="font-ui min-h-11 cursor-pointer font-medium">{q}</summary>
      <div className="text-ink mt-2 space-y-2">{children}</div>
    </details>
  );
}

/**
 * Frequently asked questions. Answers restate the decisions (D-001, D-002, D-004, D-008, D-036, D-066, D-070 – D-073,
 * D-076) with the numbers from store_policy(), the same the rules apply; nothing about shops or sourcing (D-003).
 * TODO(founder): approve this draft (written by Claude; design.md voice).
 */
export default async function Page(): Promise<React.JSX.Element> {
  const p = await getStorePolicyCached();
  const express = dayRange(p.express_days_min, p.express_days_max);
  const tiers = returnTiers(p);
  const lastTier = p.return_tiers.at(-1);

  return (
    <InfoPage title="FAQ">
      <div>
        <Item q="What do you sell?">
          <p>
            Clothing and spices from India&apos;s 28 states and 8 union territories. Pick the state you miss, or any state
            you love, and shop what it is known for.
          </p>
        </Item>
        <Item q="Where do the pieces come from?">
          <p>
            Every piece is made in India. Its page shows the state it comes from, and it is imported to the US for your
            order.
          </p>
        </Item>
        <Item q="When will my order arrive?">
          <p>
            Before you pay, you see the estimated delivery window for your order, and it is on every product page too.
            {express ? ` Express arrives in about ${express} from your order.` : ''} If the date moves, we email you the
            new one.
          </p>
        </Item>
        <Item q="How much is shipping?">
          <p>
            Standard shipping is {standardShipping(p)}. Express, when offered, depends on your bag and is shown at
            checkout. We deliver in the US only.
          </p>
        </Item>
        <Item q="Do you charge sales tax?">
          <p>{taxSentence(p.tax)}</p>
        </Item>
        <Item q="What currency do you charge in?">
          <p>US dollars. Shipping and any sales tax are shown at checkout, before you pay.</p>
        </Item>
        <Item q="How do I follow my order?">
          <p>
            Your order email links to your order page, or find it with your order number and email on{' '}
            <Link href="/orders/lookup" className="underline">
              Track your order
            </Link>
            . We email you at every step, with a tracking link once it ships.
          </p>
        </Item>
        <Item q="My delivery date moved. What can I do?">
          <p>Keep your order with the new date, or cancel it and get everything back, from your order page.</p>
        </Item>
        <Item q="Can I cancel?">
          <p>{cancelSentence(p)}</p>
        </Item>
        <Item q="Can I return something?">
          {p.return_claim_days !== null ? (
            <p>
              If a piece arrives damaged or is not what you ordered, tell us from your order page within{' '}
              {p.return_claim_days} days of delivery and you get everything back.
            </p>
          ) : null}
          {tiers && lastTier ? (
            <p>
              Changed your mind? Unworn, unaltered clothing can come back: we keep {tiers} of delivery, for bringing it
              back. After {lastTier.days} days, returns are closed. Food and spices are final sale.
            </p>
          ) : null}
          <p>We collect the piece from your door, just as it was delivered.</p>
        </Item>
        <Item q="When do I get my refund?">
          <p>
            We refund your card as soon as a cancel goes through, or once a returned piece reaches us. Banks usually take
            5 to 10 days to show it.
          </p>
        </Item>
      </div>
      <p className="text-ink-muted text-sm">
        More on{' '}
        <Link href="/shipping-returns" className="underline">
          shipping and returns
        </Link>
        .
      </p>
    </InfoPage>
  );
}
