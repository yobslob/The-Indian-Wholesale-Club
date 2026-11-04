import { DUTIES_PAID } from '@repo/shared/domain';

import { DutiesStamp } from './duties-stamp';

/**
 * D-187: the delivery line of a product page, in delivery days, never a date ("At your door in 7 delivery days."): the
 * days come from Settings (non-negotiable 4), the FAQ says what a delivery day is. A piece already in the US (D-072)
 * counts its own days from the warehouse. Then "Duties paid. Nothing to pay at your door." with its stamp (D-161).
 */
export function DeliveryNote({
  days,
  fromUs = null,
}: {
  /** "7 delivery days", "12 – 16 delivery days"; null when the days are not set. */
  days: string | null;
  /** A US piece's days ("3 – 7 days"); null for a piece coming from India. */
  fromUs?: string | null;
}): React.JSX.Element {
  if (!days && !fromUs) return <p className="text-ink-muted text-sm">Delivery days have not been announced yet.</p>;
  return (
    <div className="relative pr-[68px]">
      <p className="text-ink m-0 text-sm">
        {fromUs ? (
          <>
            Already in the US. At your door in <strong>{fromUs}</strong>{' '}
            <span className="text-ink-muted">when ordered on its own.</span>
          </>
        ) : (
          <>
            At your door in <strong>{days}</strong>.
          </>
        )}
      </p>
      {DUTIES_PAID ? <p className="text-ink-muted m-0 mt-1.5 text-[13px]">Duties paid. Nothing to pay at your door.</p> : null}
      <DutiesStamp />
    </div>
  );
}
