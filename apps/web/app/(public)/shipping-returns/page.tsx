import { SHIPPING_RATES } from '@repo/shared/constants';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shipping & Returns — ROOT',
  description:
    'Detailed information regarding US domestic shipping rates, delivery timelines, and our 30-day hassle-free return policy.',
};

export default function ShippingReturnsPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-12 md:px-8 md:py-20">
      <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
        Shipping & Returns
      </h1>

      <div className="mt-8 space-y-10 text-sm leading-relaxed text-neutral-600">
        <section>
          <h2 className="font-display text-primary text-xl font-bold">Domestic US Shipping</h2>
          <p className="mt-2">
            We proudly ship to all 50 US states and territories, including APO/FPO addresses. Orders
            are processed and dispatched Monday through Friday, excluding major US holidays.
          </p>

          <div className="mt-4 overflow-hidden rounded-lg border border-neutral-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold uppercase tracking-wider text-neutral-900">
                <tr>
                  <th className="px-4 py-3">Shipping Method</th>
                  <th className="px-4 py-3">Delivery Estimate</th>
                  <th className="px-4 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                <tr>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    Standard Shipping
                  </td>
                  <td className="px-4 py-3">{SHIPPING_RATES.standard.windowLabel}</td>
                  <td className="px-4 py-3">
                    {`$${SHIPPING_RATES.standard.price} (FREE over $${SHIPPING_RATES.freeThreshold})`}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    Express Shipping
                  </td>
                  <td className="px-4 py-3">{SHIPPING_RATES.express.windowLabel}</td>
                  <td className="px-4 py-3">{`$${SHIPPING_RATES.express.price}`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="font-display text-primary text-xl font-bold">
            30-Day Hassle-Free Returns
          </h2>
          <p className="mt-2">
            We want you to love your essentials. If you are not completely satisfied, we accept
            returns of unworn, unwashed items in original packaging with tags intact within 30 days
            from delivery.
          </p>
          <p className="mt-2">
            Returns for store credit and exchanges are always 100% free. Returns refunded to
            original payment methods incur a flat $5.00 return label fee deducted from your total
            refund.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-xl font-bold">How to Initiate a Return</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              Contact support at{' '}
              <a href="mailto:support@root.com" className="text-primary underline">
                support@root.com
              </a>{' '}
              with your order number.
            </li>
            <li>Receive your prepaid USPS/FedEx return shipping label via email.</li>
            <li>
              Pack the items securely and drop the package off at any authorized drop-off location.
            </li>
            <li>Once inspected at our facility, refunds are processed within 3–5 business days.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
