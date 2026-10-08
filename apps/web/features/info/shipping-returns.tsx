import { getStorePolicyCached } from '@/features/catalog/data';

import { cancelSentence, dayRange, returnTiers, standardShipping, taxSentence } from './policy-text';


/**
 * Shipping & returns. Every number comes from store_policy(), the same settings the rules apply (D-008: never a
 * hard-coded promise), so a change in the admin changes this page too.
 * TODO(founder): approve this draft (written by Claude from D-070 – D-073, D-076 and D-008; design.md voice).
 */
export async function ShippingReturnsText(): Promise<React.JSX.Element> {
  const p = await getStorePolicyCached();
  const express = dayRange(p.express_days_min, p.express_days_max);
  const usDays = dayRange(p.us_delivery_days_min, p.us_delivery_days_max);
  const tiers = returnTiers(p);
  const lastTier = p.return_tiers.at(-1);

  return (
    <>
      <h2 className="font-medium">Delivery</h2>
      <p>
        Every piece is made in India and comes to you from there. Before you pay, you see the estimated delivery window
        for your order, and we tell you if it changes.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Standard</strong>: {standardShipping(p)}. The window is on every product page and at checkout.
        </li>
        {express ? (
          <li>
            <strong>Express</strong>: about {express} from your order, sent straight to your door. Its price depends on
            your bag and is shown at checkout.
          </li>
        ) : null}
        {usDays ? (
          <li>
            <strong>Already in the US</strong>: some pieces are marked so on their page. On their own they arrive in
            about {usDays}.
          </li>
        ) : null}
      </ul>
      <p>We deliver in the US only. {taxSentence(p.tax)}</p>

      <h2 className="font-medium">If your delivery date moves</h2>
      <p>
        We email you the new window. You can keep your order with the new date, or cancel it and get everything back,
        from your order page.
      </p>

      <h2 className="font-medium">Cancelling</h2>
      <p>{cancelSentence(p)}</p>

      <h2 className="font-medium">Returns</h2>
      <ul className="list-disc space-y-1 pl-5">
        {p.return_claim_days !== null ? (
          <li>
            <strong>Damaged or not what you ordered</strong>: tell us from your order page within {p.return_claim_days}{' '}
            days of delivery and you get everything back, shipping included.
          </li>
        ) : null}
        {tiers && lastTier ? (
          <li>
            <strong>Changed your mind</strong>: unworn, unaltered clothing can come back. We keep part of the price for
            bringing it back: {tiers} of delivery. After {lastTier.days} days, returns are closed.
          </li>
        ) : null}
        <li>
          <strong>Food and spices</strong> are final sale, unless they arrive damaged or are not what you ordered.
        </li>
      </ul>
      <p>
        Your order page shows what you would get back before you ask. We collect the piece from your door, just as it was
        delivered, and the refund goes to your card once it reaches us. Banks usually take 5 to 10 days to show it.
      </p>
    </>
  );
}
