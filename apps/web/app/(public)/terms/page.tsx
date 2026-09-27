import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — ROOT',
  description: 'Terms and conditions governing the use of the ROOT website and storefront.',
};

export default function TermsPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-12 md:px-8 md:py-20">
      <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
        Terms of Service
      </h1>
      <p className="mt-2 text-xs text-neutral-400">Last updated: September 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">
        <section>
          <h2 className="font-display text-primary text-lg font-bold">1. Agreement to Terms</h2>
          <p className="mt-2">
            By accessing or placing an order on ROOT, you agree to be bound by these Terms of
            Service and all applicable laws and regulations of the United States.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">
            2. Product Availability & Pricing
          </h2>
          <p className="mt-2">
            All prices are stated in USD. We reserve the right to correct pricing errors, modify
            product specifications, or limit order quantities without prior notice.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">3. Intellectual Property</h2>
          <p className="mt-2">
            All text, imagery, graphics, garment designs, and trademarks displayed on this site are
            the exclusive property of ROOT and may not be reproduced without written permission.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">4. Governing Law</h2>
          <p className="mt-2">
            These terms are governed by the laws of the State of New York and the United States of
            America.
          </p>
        </section>
      </div>
    </div>
  );
}
