import { CARRIERS, trackingUrl } from '@repo/shared/domain';

import { markDeliveredAction, markShippedAction } from './actions/orders';
import { button, Field, input } from './ui';

interface ShipOrder {
  id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  items: { status: string; pickup: { status: string; arrived_at: string | null } | null }[];
}

/**
 * flows.md §6.4: pack and ship once the export has arrived, then mark delivered. USPS, UPS and FedEx give the customer
 * a tracking link (D-066); any other carrier is typed and its number shown as is.
 */
export function ShipForm({ order }: { order: ShipOrder }): React.JSX.Element {
  const link = trackingUrl(order.carrier, order.tracking_number);
  const unchecked = order.items.filter((i) => i.pickup?.status === 'picked' && !i.pickup.arrived_at).length;

  return (
    <div className="border-line space-y-2 rounded-md border p-3">
      <h2 className="font-medium">Pack &amp; ship</h2>
      {order.status === 'arrived' ? (
        <form action={markShippedAction.bind(null, order.id)} className="space-y-2">
          {unchecked > 0 ? (
            <p className="text-caution text-sm">
              {unchecked} piece{unchecked === 1 ? ' is' : 's are'} not checked off as arrived yet.
            </p>
          ) : null}
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
          <Field label="Other carrier's name">
            <input name="otherCarrier" className={input} />
          </Field>
          <Field label="Tracking number">
            <input name="tracking" required className={input} />
          </Field>
          <button type="submit" className={button}>
            Mark shipped
          </button>
        </form>
      ) : order.status === 'shipped' ? (
        <>
          <p className="text-sm">
            {order.carrier} ·{' '}
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" className="underline">
                {order.tracking_number}
              </a>
            ) : (
              order.tracking_number
            )}
          </p>
          <form action={markDeliveredAction.bind(null, order.id)}>
            <button type="submit" className={button}>
              Mark delivered
            </button>
          </form>
        </>
      ) : (
        <p className="text-ink-muted text-sm">
          {order.status === 'delivered'
            ? `Delivered · ${order.carrier ?? ''} ${order.tracking_number ?? ''}`
            : 'Ships once its export has arrived in the US.'}
        </p>
      )}
    </div>
  );
}
