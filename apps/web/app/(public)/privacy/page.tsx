import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — ROOT',
  description: 'Learn how ROOT collects, protects, and handles your personal information.',
};

export default function PrivacyPolicyPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-screen-md px-4 py-12 md:px-8 md:py-20">
      <h1 className="font-display text-primary text-4xl font-bold tracking-tight md:text-5xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-xs text-neutral-400">Last updated: September 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-neutral-600">
        <section>
          <h2 className="font-display text-primary text-lg font-bold">1. Information We Collect</h2>
          <p className="mt-2">
            When you visit or place an order on ROOT, we collect necessary personal information such
            as your name, shipping address, billing address, email address, and phone number to
            fulfill your orders and provide client services.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">2. Payment Security</h2>
          <p className="mt-2">
            Payment card information is securely tokenized and processed via Stripe. We do not store
            or have access to your raw credit or debit card numbers on our servers.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">3. How We Use Your Data</h2>
          <p className="mt-2">
            We use your information solely to process orders, communicate shipment updates, provide
            support, and send optional marketing updates if you have opted in. We never sell or rent
            your personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="font-display text-primary text-lg font-bold">4. Your Rights</h2>
          <p className="mt-2">
            You may request access to, correction of, or deletion of your personal data at any time
            by contacting our privacy team at{' '}
            <a href="mailto:privacy@root.com" className="text-primary underline">
              privacy@root.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
