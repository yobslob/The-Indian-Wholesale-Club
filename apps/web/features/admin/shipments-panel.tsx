import { dateRange, shipmentShipState } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';

import {
  changeShipmentWindowAction,
  markShipmentDeliveredAction,
  markShipmentShippedAction,
} from './actions/orders';
import { cancelShipmentAction } from './actions/refunds';
import { Chip, type Tone } from './chips';
import { ConfirmButton, FormButton } from './confirm';
import { ShipControls } from './ship-form';
import { dangerButton, Field, input, Panel, When } from './ui';

import type { getAdminOrder } from '@repo/db/admin';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;
type Shipment = Order['shipments'][number];

const KIND: Record<string, string> = { quick: '7-day', standard: 'Standard', express: 'Express' };
const STATUS: Record<string, [string, Tone]> = {
  open: ['Being prepared', 'warn'],
  shipped: ['On its way', 'blue'],
  delivered: ['Delivered', 'ok'],
  cancelled: ['Cancelled', 'mute'],
};
const HOUR = 3_600_000;

/** Whole days from today to the promised last day ("2 days left", "1 day late"). */
function timeLeft(to: string | null, now = Date.now()): string | null {
  if (!to) return null;
  const days = Math.ceil((Date.parse(`${to}T23:59:59Z`) - now) / (24 * HOUR));
  if (days >= 0) return `${days} day${days === 1 ? '' : 's'} left`;
  return `${-days} day${days === -1 ? '' : 's'} late`;
}

/**
 * D-154: an order of two shipments, each on its own (the plan's "Operations"): its pieces, its promised dates and the
 * time left, its own Ship form and tracking, its own delay notice and its own cancel with the amount shown first. A
 * 7-day shipment shows the desk's buy-by (2 hours) and ship-by (the next day) times while it is open.
 */
export function ShipmentsPanel({
  order,
  cancels,
}: {
  order: Order;
  /** The refund for cancelling each shipment on its own (the customer asked, or because of us); absent when it can't be. */
  cancels: Map<string, { customer: number | null; ours: number | null }>;
}): React.JSX.Element {
  const shipments = [...order.shipments].sort((a, b) => a.seq - b.seq);
  return (
    <Panel title={`${shipments.length} shipments`} note="each ships, and is late, on its own">
      <div className="grid gap-4">
        {shipments.map((sh, i) => (
          <ShipmentBlock
            key={sh.id}
            order={order}
            shipment={sh}
            cancel={cancels.get(sh.id)}
            first={i === 0}
          />
        ))}
      </div>
    </Panel>
  );
}

function ShipmentBlock({
  order,
  shipment: sh,
  cancel,
  first,
}: {
  order: Order;
  shipment: Shipment;
  cancel: { customer: number | null; ours: number | null } | undefined;
  first: boolean;
}): React.JSX.Element {
  const pieces = order.items.filter((it) => it.shipment_id === sh.id);
  const { canShip, fromHub, unchecked } = shipmentShipState(order, sh);
  const [label, tone] = STATUS[sh.status] ?? [sh.status, 'mute'];
  const open = sh.status === 'open';
  const placed = Date.parse(order.created_at);
  const name = `shipment ${sh.seq} of order ${order.order_number}`;
  const mail = (amount: number) => ({
    subject: `Shipment ${sh.seq} of order ${order.order_number} is cancelled`,
    text: `It says ${formatUsd(amount)} is on its way back to their card and that the rest of the order is still coming.`,
  });

  return (
    <section className={first ? '' : 'border-line border-t pt-4'}>
      <h3 className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
        Shipment {sh.seq}
        <Chip tone={sh.kind === 'quick' ? 'brand' : 'mute'}>{KIND[sh.kind] ?? sh.kind}</Chip>
        <Chip tone={tone}>{label}</Chip>
      </h3>
      <p className="text-[13.5px]">
        Promised {dateRange(sh.est_delivery_from, sh.est_delivery_to)}
        {open ? <span className="text-ink-muted"> · {timeLeft(sh.est_delivery_to)}</span> : null} ·
        Shipping {formatUsd(sh.shipping_cents)}
      </p>
      {open && sh.kind === 'quick' ? (
        <p className="text-ink-muted text-[12.5px]">
          Buy by <When iso={new Date(placed + 2 * HOUR).toISOString()} inline /> · ship by{' '}
          <When iso={new Date(placed + 24 * HOUR).toISOString()} inline />
        </p>
      ) : null}
      <ul className="my-2 text-[13.5px] leading-[1.45]">
        {pieces.map((p) => (
          <li key={p.id} className={p.status === 'active' ? '' : 'text-ink-muted line-through'}>
            {p.product_name} ({p.variant_label}) × {p.quantity}
          </li>
        ))}
      </ul>
      <ShipControls
        title={`Pack & ship shipment ${sh.seq}`}
        canShip={canShip}
        unchecked={unchecked}
        shipped={sh.status === 'shipped'}
        carrier={sh.carrier}
        trackingNumber={sh.tracking_number}
        ship={markShipmentShippedAction.bind(null, order.id, sh.id)}
        deliver={markShipmentDeliveredAction.bind(null, order.id, sh.id)}
      />
      {open && !canShip ? (
        <p className="text-ink-muted text-[13px]">
          {fromHub
            ? 'Ships from the hub once every piece is there.'
            : 'Ships once its export has arrived.'}
        </p>
      ) : null}
      {open ? (
        <div className="mt-2.5 grid gap-2">
          <FormButton
            label={`New dates for shipment ${sh.seq}…`}
            title={`New delivery dates for shipment ${sh.seq}`}
            submit="Change dates"
            action={changeShipmentWindowAction.bind(null, order.id, sh.id)}
            mail={{
              subject: `New delivery date for ${name}`,
              text: 'It gives the new dates; when they are later, the customer can keep it or cancel this shipment for its share back.',
            }}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="From">
                <input name="from" type="date" required className={input} />
              </Field>
              <Field label="To">
                <input name="to" type="date" required className={input} />
              </Field>
            </div>
            <Field label="Internal note">
              <input name="note" className={input} />
            </Field>
          </FormButton>
          {cancel?.customer != null ? (
            <ConfirmButton
              label={`Cancel shipment ${sh.seq}, the customer asked: refund ${formatUsd(cancel.customer)}…`}
              className={`${dangerButton} w-full whitespace-normal py-2 text-left md:h-auto`}
              title={`Cancel shipment ${sh.seq} and refund ${formatUsd(cancel.customer)}?`}
              confirm={`Cancel and refund ${formatUsd(cancel.customer)}`}
              action={cancelShipmentAction.bind(null, order.id, sh.id, 'customer_request')}
              mail={mail(cancel.customer)}
            >
              Only {name}: its pieces, its Shipping share and their tax come back; the other
              shipment goes on.
            </ConfirmButton>
          ) : null}
          {cancel?.ours != null ? (
            <ConfirmButton
              label={`Cancel shipment ${sh.seq} because of us: refund ${formatUsd(cancel.ours)}…`}
              className={`${dangerButton} w-full whitespace-normal py-2 text-left md:h-auto`}
              title={`Cancel shipment ${sh.seq} and refund ${formatUsd(cancel.ours)}?`}
              confirm={`Cancel and refund ${formatUsd(cancel.ours)}`}
              action={cancelShipmentAction.bind(null, order.id, sh.id, 'our_fault')}
              mail={mail(cancel.ours)}
            >
              Only {name}, because of us: everything for it back; the other shipment goes on.
            </ConfirmButton>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
