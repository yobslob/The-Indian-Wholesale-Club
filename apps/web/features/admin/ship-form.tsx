import { shipState } from '@repo/shared/admin';
import { CARRIERS, trackingUrl } from '@repo/shared/domain';

import { markDeliveredAction, markShippedAction } from './actions/orders';
import { button, Field, input } from './ui';

export { shipState };

export interface ShipOrder {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  items: { status: string; pickup: { status: string } | null }[];
}

/**
 * Pack and ship once its pieces are at the hub, then mark delivered. USPS, UPS and FedEx give the customer a
 * tracking link (D-066); any other carrier is typed and its number shown as is. Shown only when it applies (D-096).
 * One order, or one of its two shipments (D-154): the caller passes the actions bound to it.
 */
export function ShipControls({
  title = 'Pack & ship',
  canShip,
  shipped,
  carrier,
  trackingNumber,
  ship,
  deliver,
}: {
  title?: string;
  canShip: boolean;
  /** On its way: the tracking and Mark delivered. */
  shipped: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  ship: (form: FormData) => Promise<void>;
  deliver: () => Promise<void>;
}): React.JSX.Element | null {
  const link = trackingUrl(carrier, trackingNumber);

  if (canShip)
    return (
      <form action={ship} className="space-y-2.5">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Carrier">
            <select name="carrier" required className={input} defaultValue={CARRIERS[0]}>
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Other">Other (no tracking link)</option>
            </select>
          </Field>
          <Field label="Tracking number">
            <input name="tracking" required minLength={4} className={input} />
          </Field>
        </div>
        <Field label="Other carrier's name (only for Other)">
          <input name="otherCarrier" className={input} />
        </Field>
        <button type="submit" className={`${button} w-full md:h-12 md:text-[15px]`}>
          Mark shipped
        </button>
        <p className="text-ink-muted text-[12.5px]">Emails the customer a link to their order page.</p>
      </form>
    );
  if (shipped)
    return (
      <div className="space-y-2.5">
        <h3 className="text-[14px] font-semibold">On its way</h3>
        <p className="text-[14px]">
          {carrier} ·{' '}
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="font-semibold underline">
              {trackingNumber}
            </a>
          ) : (
            trackingNumber
          )}
        </p>
        <form action={deliver}>
          <button type="submit" className={`${button} w-full md:h-12 md:text-[15px]`}>
            Mark delivered
          </button>
        </form>
        <p className="text-ink-muted text-[12.5px]">Emails the customer that it arrived.</p>
      </div>
    );
  return null;
}

export function ShipForm({ order }: { order: ShipOrder }): React.JSX.Element | null {
  const { canShip } = shipState(order);
  return (
    <ShipControls
      canShip={canShip}
      shipped={order.status === 'shipped'}
      carrier={order.carrier}
      trackingNumber={order.tracking_number}
      ship={markShippedAction.bind(null, order.id)}
      deliver={markDeliveredAction.bind(null, order.id)}
    />
  );
}
