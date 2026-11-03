import Link from 'next/link';

import { supportEmail } from '@/lib/env';

import type { OrderStatus } from './use-order-status';

/** Write to us at …, or the Contact page while the support address is not set (Q-9). */
function WriteToUs(): React.JSX.Element {
  const email = supportEmail();
  return email ? (
    <>
      write to us at{' '}
      <a href={`mailto:${email}`} className="underline">
        {email}
      </a>
    </>
  ) : (
    <>
      write to us from the{' '}
      <Link href="/contact" className="underline">
        Contact page
      </Link>
    </>
  );
}

/**
 * The thank-you page when there is no order number to show (launch QA A-4): calm words and a way to reach us,
 * never a spinner that runs forever.
 */
export function ConfirmNotice({
  status,
}: {
  status: Exclude<OrderStatus, { phase: 'confirmed' | 'confirming' }>;
}): React.JSX.Element {
  const keepBrowsing = (
    <Link href="/states" className="text-ink-muted font-ui text-sm underline">
      Keep browsing
    </Link>
  );
  if (status.phase === 'refused') {
    return (
      <div className="space-y-4" role="alert">
        <p className="text-ink">{status.message}</p>
        <Link href="/cart" className="font-ui text-sm underline">
          Back to your bag
        </Link>
      </div>
    );
  }
  if (status.phase === 'none') return <div className="space-y-4">{keepBrowsing}</div>;
  return (
    <div className="max-w-[60ch] space-y-4" aria-live="polite">
      {status.phase === 'gave_up' && status.paid ? (
        <>
          <h1 className="font-heading text-[clamp(28px,2.6vw,44px)] font-medium leading-tight tracking-[-0.03em] text-[#1D1A17]">
            Thank you. Your payment went through.
          </h1>
          <p className="text-ink">
            We are still confirming your order and will email your order number shortly. If it does
            not arrive, <WriteToUs />.
          </p>
        </>
      ) : status.phase === 'gave_up' ? (
        <p className="text-ink">
          Your payment is still being processed. We will email you as soon as it completes. If you
          have questions, <WriteToUs />.
        </p>
      ) : (
        <p className="text-ink">
          We could not confirm this payment here. If you were charged, <WriteToUs /> and we will
          sort it out.
        </p>
      )}
      {keepBrowsing}
    </div>
  );
}
