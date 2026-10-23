import { arrivalLine, trackingUrl } from '@repo/shared/domain';

import type { OrderDetail, OrderShipment } from '@repo/db/store';

const STATUS: Record<OrderShipment['status'], string> = {
  open: 'Being prepared',
  shipped: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * D-154: an order of two shipments shows each one: "Shipment 1 · Arrives by Fri, Oct 30", where it stands, its own
 * Track the parcel (D-066) and its pieces (`renderItem`, the page's own rows). One order number, one receipt.
 */
export function OrderShipments({
  order,
  renderItem,
}: {
  order: OrderDetail;
  renderItem: (item: OrderDetail['items'][number]) => React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      {order.shipments.map((sh) => {
        const ids = new Set(sh.item_ids);
        const link = trackingUrl(sh.carrier, sh.tracking_number);
        return (
          <section key={sh.seq} aria-label={`Shipment ${sh.seq}`}>
            <h2 className="font-ui m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2 text-[15px] font-semibold">
              <span className={sh.kind === 'quick' ? 'text-brand' : 'text-ink'}>
                {[`Shipment ${sh.seq}`, sh.status === 'cancelled' ? null : arrivalLine(sh.est_delivery_from, sh.est_delivery_to)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="text-ink-muted text-[13px] font-medium">{STATUS[sh.status]}</span>
              {link ? (
                <a href={link} target="_blank" rel="noreferrer" className="text-[13px] font-semibold underline underline-offset-[3px]">
                  Track the parcel <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens the carrier&apos;s site)</span>
                </a>
              ) : sh.tracking_number ? (
                <small className="text-ink-muted text-[13px]">{[sh.carrier, sh.tracking_number].filter(Boolean).join(' · ')}</small>
              ) : null}
            </h2>
            <ul className="border-line m-0 list-none border-t p-0">{order.items.filter((i) => ids.has(i.id)).map(renderItem)}</ul>
          </section>
        );
      })}
    </div>
  );
}
