import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TIMELINE,
  formatDeliveryWindow,
  formatUsd,
  orderEventLabel,
  timelineIndex,
} from '@repo/shared/domain';

import type { OrderDetail } from '@repo/db/store';

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

/**
 * One order as the customer sees it (flows.md §8): customer status, timeline,
 * delivery window, items, totals, tracking. Only customer-safe fields exist in
 * OrderDetail (store_my_order / guest_order_lookup), so nothing internal can show.
 */
export function OrderView({ order }: { order: OrderDetail }): React.JSX.Element {
  const o = order.order;
  const step = timelineIndex(o.customer_status);
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-ink-muted text-sm">Order {o.order_number}</p>
        <p className="text-ink text-xl font-medium">{CUSTOMER_STATUS_LABEL[o.customer_status]}</p>
        {o.est_delivery_from && o.est_delivery_to ? (
          <p className="text-ink text-sm">
            Estimated delivery {formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}
          </p>
        ) : null}
        {o.carrier || o.tracking_number ? (
          // TODO(founder): Q-3. Carrier tracking links come once the US carrier is chosen.
          <p className="text-ink text-sm">
            Tracking: {[o.carrier, o.tracking_number].filter(Boolean).join(' ')}
          </p>
        ) : null}
      </div>

      {step >= 0 ? (
        <ol className="flex flex-wrap gap-2 text-xs">
          {CUSTOMER_TIMELINE.map((s, i) => (
            <li
              key={s}
              className={`rounded-sm border px-2 py-1 ${i <= step ? 'border-ink text-ink' : 'border-line text-ink-muted'}`}
            >
              {CUSTOMER_STATUS_LABEL[s]}
            </li>
          ))}
        </ol>
      ) : null}

      <ul className="divide-line border-line divide-y border-y text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-3">
            <span>
              {item.product_name} · {item.variant_label} · {item.region_name} × {item.quantity}
              {item.status !== 'active' ? (
                <span className="text-caution block">
                  {item.status === 'unavailable'
                    ? 'No longer available, being refunded'
                    : 'Refunded'}
                </span>
              ) : null}
            </span>
            <span>{formatUsd(item.total_price_cents)}</span>
          </li>
        ))}
      </ul>

      <dl className="max-w-sm space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd>{formatUsd(o.subtotal_cents)}</dd>
        </div>
        {o.discount_cents > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Discount</dt>
            <dd>−{formatUsd(o.discount_cents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-ink-muted">Shipping</dt>
          <dd>{o.shipping_cents === 0 ? 'Free' : formatUsd(o.shipping_cents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Estimated tax</dt>
          <dd>{formatUsd(o.tax_cents)}</dd>
        </div>
        <div className="border-line flex justify-between border-t pt-1 font-medium">
          <dt>Total</dt>
          <dd>{formatUsd(o.total_cents)}</dd>
        </div>
      </dl>

      {order.events.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-ink text-sm font-medium">Updates</h2>
          <ul className="space-y-1 text-sm">
            {order.events.map((e) => (
              <li key={e.id}>
                <span className="text-ink-muted">{dateTime.format(new Date(e.created_at))}</span> ·{' '}
                {orderEventLabel(e.kind)}
                {e.message ? ` · ${e.message}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
