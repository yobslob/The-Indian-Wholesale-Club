import { CARRIERS, trackingUrl } from '@repo/shared/domain';

import { markDeliveredAction, markShippedAction } from './actions/orders';
import { button, Field, input } from './ui';

export interface ShipOrder {
  id: string;
  status: string;
  shipping_method: string;
  cycle_id: string | null;
  carrier: string | null;
  tracking_number: string | null;
  items: { status: string; pickup: { status: string; arrived_at: string | null } | null }[];
}

/** What the order's main action is now (D-096): pack and ship, mark delivered, or nothing on this side. */
export function shipState(order: ShipOrder): { canShip: boolean; express: boolean; unpicked: number; unchecked: number } {
  const express = order.shipping_method === 'express' && !order.cycle_id; // D-070: courier straight from India
  const unpicked = order.items.filter((i) => i.status === 'active' && i.pickup?.status === 'pending').length;
  const canShip = express ? ['confirmed', 'collecting'].includes(order.status) && unpicked === 0 : order.status === 'arrived';
  const unchecked = express ? 0 : order.items.filter((i) => i.pickup?.status === 'picked' && !i.pickup.arrived_at).length;
  return { canShip, express, unpicked, unchecked };
}

/**
 * flows.md §6.4: pack and ship once the export has arrived, then mark delivered. USPS, UPS and FedEx give the customer
 * a tracking link (D-066); any other carrier is typed and its number shown as is. Shown only when it applies (D-096).
 */
export function ShipForm({ order }: { order: ShipOrder }): React.JSX.Element | null {
  const { canShip, unchecked } = shipState(order);
  const link = trackingUrl(order.carrier, order.tracking_number);

  if (canShip)
    return (
      <form action={markShippedAction.bind(null, order.id)} className="space-y-2.5">
        <h3 className="text-[14px] font-semibold">Pack &amp; ship</h3>
        {unchecked > 0 ? (
          <p className="text-caution text-[13px]">
            {unchecked} piece{unchecked === 1 ? ' is' : 's are'} not checked off as arrived yet.
          </p>
        ) : null}
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
  if (order.status === 'shipped')
    return (
      <div className="space-y-2.5">
        <h3 className="text-[14px] font-semibold">On its way</h3>
        <p className="text-[14px]">
          {order.carrier} ·{' '}
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="font-semibold underline">
              {order.tracking_number}
            </a>
          ) : (
            order.tracking_number
          )}
        </p>
        <form action={markDeliveredAction.bind(null, order.id)}>
          <button type="submit" className={`${button} w-full md:h-12 md:text-[15px]`}>
            Mark delivered
          </button>
        </form>
        <p className="text-ink-muted text-[12.5px]">Emails the customer that it arrived.</p>
      </div>
    );
  return null;
}
