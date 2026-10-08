import {
  CUSTOMER_STATUS_LABEL,
  CUSTOMER_TIMELINE,
  formatDeliveryWindow,
  formatUsd,
  orderEventLabel,
  timelineIndex,
  trackingUrl,
} from '@repo/shared/domain';

import { LinePhoto } from '@/features/cart/bag-lines';

import { FasterOffer } from './faster-offer';
import { OrderChoices } from './order-choices';
import { ReturnChoices } from './return-choices';

import type { OrderDetail } from '@repo/db/store';

const dateTime = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** The update that marks each timeline step reached (order_events.kind, ORDER_EVENT_LABEL). */
const STEP_EVENT: Record<string, string> = {
  confirmed: 'order_confirmed',
  preparing: 'preparing',
  shipped: 'shipped',
  delivered: 'delivered',
};

/**
 * Confirmed → Preparing your order → Shipped → Delivered as a line that fills to the current step, each reached step
 * with the date of its update (D-088). Not drawn for cancelled or refunded orders (step -1).
 */
function Timeline({ order, step }: { order: OrderDetail; step: number }): React.JSX.Element {
  const when = (status: string): string | null => {
    const event = order.events.find((e) => e.kind === STEP_EVENT[status]);
    return event ? shortDate.format(new Date(event.created_at)) : null;
  };
  const last = CUSTOMER_TIMELINE.length - 1;
  return (
    <ol
      className="relative m-0 mt-[clamp(22px,2.4vw,32px)] grid list-none grid-cols-4 p-0"
      aria-label="Order progress"
    >
      <span
        aria-hidden="true"
        className="bg-line absolute left-[12.5%] right-[12.5%] top-[9px] h-0.5 rounded-sm"
      />
      <span
        aria-hidden="true"
        className="bg-ink absolute left-[12.5%] top-[9px] h-0.5 rounded-sm"
        style={{ width: `${(75 * step) / last}%` }}
      />
      {CUSTOMER_TIMELINE.map((s, i) => {
        const reached = i <= step;
        const date = reached ? when(s) : null;
        return (
          <li
            key={s}
            className={`font-ui relative z-[1] text-center text-[13px] font-medium leading-snug ${reached ? 'text-black' : 'text-ink-muted'}`}
            aria-current={i === step ? 'step' : undefined}
          >
            <i
              aria-hidden="true"
              className={`mx-auto mb-2 block size-5 rounded-full border-2 ${reached ? 'border-ink bg-ink' : 'border-line bg-canvas'} ${
                i === step ? 'shadow-[0_0_0_5px_rgb(30_27_22/0.12)]' : ''
              }`}
            />
            {CUSTOMER_STATUS_LABEL[s]}
            {date ? (
              <small className="text-ink-muted mt-0.5 block text-xs font-normal">{date}</small>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One order as the customer sees it (flows.md §8, D-088): a status card (number, status, delivery window, Track the
 * parcel once shipped, the timeline), the offer and choices when they apply, the items with photos, totals and
 * updates. Only customer-safe fields exist in OrderDetail (store_my_order / guest_order_lookup), so nothing internal
 * can show.
 */
export function OrderView({ order }: { order: OrderDetail }): React.JSX.Element {
  const o = order.order;
  const step = timelineIndex(o.customer_status);
  const tracking = trackingUrl(o.carrier, o.tracking_number);
  return (
    <div className="max-w-[860px] space-y-6">
      <section className="bg-surface rounded-lg p-[clamp(22px,2.6vw,36px)]">
        <p className="font-ui text-ink-muted m-0 text-sm font-medium">Order {o.order_number}</p>
        <h1 className="font-heading mt-2.5 text-[clamp(30px,3.4vw,48px)] font-medium leading-tight tracking-[-0.02em] text-[#1D1A17]">
          {CUSTOMER_STATUS_LABEL[o.customer_status]}
        </h1>
        {o.est_delivery_from && o.est_delivery_to ? (
          <p className="font-body mt-2.5 text-[17px]">
            Estimated delivery{' '}
            <b className="font-semibold">
              {formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}
            </b>
          </p>
        ) : null}
        {o.carrier || o.tracking_number ? (
          // D-066: a button for USPS, UPS and FedEx; any other carrier shows its number.
          <div className="mt-[18px] flex flex-wrap items-center gap-x-4 gap-y-2.5">
            {tracking ? (
              <a
                href={tracking}
                target="_blank"
                rel="noreferrer"
                className="bg-brand text-on-brand font-ui rounded-pill inline-flex h-12 items-center gap-2 px-[22px] text-[15px] font-semibold"
              >
                Track the parcel <span aria-hidden="true">↗</span>
                <span className="sr-only"> (opens the carrier&apos;s site)</span>
              </a>
            ) : null}
            <small className="font-ui text-ink-muted text-[13px]">
              {[o.carrier, o.tracking_number].filter(Boolean).join(' · ')}
            </small>
          </div>
        ) : null}
        {step >= 0 ? <Timeline order={order} step={step} /> : null}
      </section>

      {order.offer ? (
        <FasterOffer offer={order.offer} orderNumber={o.order_number} email={o.email} />
      ) : null}
      {order.actions ? (
        <OrderChoices
          actions={order.actions}
          orderNumber={o.order_number}
          email={o.email}
          window={
            o.est_delivery_from && o.est_delivery_to
              ? { from: o.est_delivery_from, to: o.est_delivery_to }
              : null
          }
          paidCents={o.total_cents - o.refunded_cents}
        />
      ) : null}
      {order.actions && order.actions.returns.length > 0 ? (
        <ReturnChoices
          returns={order.actions.returns}
          items={order.items}
          orderNumber={o.order_number}
          email={o.email}
        />
      ) : null}

      <ul className="border-line m-0 list-none border-t p-0">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="border-line font-ui grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3.5 border-b py-3"
          >
            <LinePhoto path={item.image_path ?? null} className="w-14 rounded-[10px]" />
            <span className="min-w-0">
              <b className="block text-[15px] font-semibold leading-snug">{item.product_name}</b>
              <small className="text-ink-muted text-[13px]">
                {item.variant_label} · {item.region_name} · × {item.quantity}
              </small>
              {item.status !== 'active' ? (
                <span className="text-caution block text-[13px]">
                  {item.status === 'unavailable'
                    ? 'No longer available, being refunded'
                    : 'Refunded'}
                </span>
              ) : null}
            </span>
            <span className="text-[15px] font-medium">{formatUsd(item.total_price_cents)}</span>
          </li>
        ))}
      </ul>

      <dl className="font-ui ml-auto grid max-w-[360px] gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="m-0">{formatUsd(o.subtotal_cents)}</dd>
        </div>
        {o.discount_cents > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink-muted">Discount</dt>
            <dd className="m-0">−{formatUsd(o.discount_cents)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-ink-muted">
            {o.shipping_method === 'express' ? 'Express shipping' : 'Shipping'}
          </dt>
          <dd className="m-0">{o.shipping_cents === 0 ? 'Free' : formatUsd(o.shipping_cents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-muted">Sales tax</dt>
          <dd className="m-0">{formatUsd(o.tax_cents)}</dd>
        </div>
        <div className="border-line flex justify-between border-t pt-2 text-base font-bold">
          <dt>Total</dt>
          <dd className="m-0">{formatUsd(o.total_cents)}</dd>
        </div>
        {o.refunded_cents > 0 ? (
          <div className="text-positive flex justify-between">
            <dt>Refunded</dt>
            <dd className="m-0">{formatUsd(o.refunded_cents)}</dd>
          </div>
        ) : null}
      </dl>

      {order.events.length > 0 ? (
        <section>
          <h2 className="font-heading m-0 mb-2.5 text-lg font-medium leading-none text-[#1D1A17]">
            Updates
          </h2>
          <ul className="font-body m-0 grid list-none gap-1.5 p-0 text-sm">
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
