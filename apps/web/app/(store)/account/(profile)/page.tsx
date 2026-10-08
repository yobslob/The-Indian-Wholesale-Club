import Link from 'next/link';

import { listMyOrderCards } from '@repo/db/store';
import { CUSTOMER_STATUS_LABEL, formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { customerOrNull } from '@/features/account/session';
import { LinePhoto } from '@/features/cart/bag-lines';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

const placed = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const h2 = 'font-heading m-0 mb-4 text-[22px] font-medium leading-tight text-[#1D1A17]';

/**
 * Orders, the profile's first section (D-089): a card per order with the first piece's photo ("+n" for the rest), the
 * number, the date placed and the delivery window, the status as a label and the total; the card opens the order page
 * (D-088). Signed out, the layout shows the sign-in card and this renders nothing.
 */
export default async function ProfileOrdersPage(): Promise<React.JSX.Element | null> {
  const me = await customerOrNull();
  if (!me) return null;
  const orders = await listMyOrderCards(me.client);
  return (
    <section aria-labelledby="orders-h">
      <h2 id="orders-h" className={h2}>
        Orders
      </h2>
      {orders.length === 0 ? (
        <p className="text-ink-muted font-body m-0 text-[15px]">No orders yet.</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {orders.map((o) => {
            const done = o.customer_status === 'delivered';
            const window =
              o.est_delivery_from && o.est_delivery_to && !['delivered', 'cancelled', 'refunded'].includes(o.customer_status)
                ? ` · arrives ${formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to)}`
                : '';
            return (
              <li key={o.id}>
                <Link
                  href={`/orders/${encodeURIComponent(o.order_number)}`}
                  className="border-line bg-paper hover:border-ink font-ui grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border p-3.5"
                >
                  <span className="relative">
                    <LinePhoto path={o.first_image_path} className="w-[72px] rounded-xl" />
                    {o.more_pieces > 0 ? (
                      <em className="bg-ink text-paper absolute -bottom-1.5 -right-1.5 rounded-pill px-1.5 py-[3px] text-[11px] font-semibold not-italic leading-none">
                        +{o.more_pieces}
                      </em>
                    ) : null}
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[15px] font-semibold leading-snug">{o.order_number}</b>
                    <small className="text-ink-muted mt-0.5 block text-[13px]">
                      Placed {placed.format(new Date(o.created_at))}
                      {window}
                    </small>
                    <span
                      className={`mt-2 inline-block rounded-pill px-2.5 py-[5px] text-xs font-semibold leading-none ${
                        done ? 'text-positive bg-[rgb(22_101_52/0.12)]' : 'bg-surface'
                      }`}
                    >
                      {CUSTOMER_STATUS_LABEL[o.customer_status]}
                    </span>
                  </span>
                  <span className="text-right text-[15px] font-semibold">
                    {formatUsd(o.total_cents)}
                    <span aria-hidden="true" className="text-ink-muted mt-2.5 block text-lg leading-none">
                      ›
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
