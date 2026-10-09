import Image from 'next/image';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

import { markExpressPickupAction } from './actions/orders';
import { refundItemAction } from './actions/refunds';
import { Chip, PICKUP_STATUS } from './chips';
import { ConfirmButton } from './confirm';
import { button, Cell, Panel, rupees, secondaryButton, Sub, Table } from './ui';

import type { getAdminOrder } from '@repo/db/admin';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/**
 * The order's pieces (D-096): photo, piece, quantity, price, where its pickup stands (picked, paid to the shop, in the
 * US) and the shop with its price. An unavailable piece gets its refund here (it asks first); an express order's
 * pieces are marked picked here (D-070).
 */
export function OrderPieces({ order, refunds, expressInIndia }: { order: Order; refunds: Map<string, number>; expressInIndia: boolean }): React.JSX.Element {
  const count = order.items.reduce((n, i) => n + i.quantity, 0);
  const arrived = order.items.filter((i) => i.pickup?.arrived_at).length;
  return (
    <Panel
      title="Pieces"
      note={`${count} piece${count === 1 ? '' : 's'}${arrived ? ` · ${arrived === order.items.length ? (order.items.length === 1 ? 'arrived' : 'all arrived') : `${arrived} arrived`}` : ''}`}
    >
      <Table head={['', 'Piece', { label: 'Qty', right: true }, { label: 'Price', right: true }, 'Pickup', 'Shop']}>
        {order.items.map((item) => {
          const media = item.product?.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
          const refund = refunds.get(item.id);
          const p = item.pickup;
          return (
            <tr key={item.id}>
              <Cell className="w-14">
                <span className="bg-land relative block h-[58px] w-11 overflow-hidden rounded-lg">
                  {media ? <Image src={mediaUrl(media.storage_path)} alt="" fill sizes="44px" className="object-cover" /> : null}
                </span>
              </Cell>
              <Cell>
                <b className="font-semibold">{item.product_name}</b>
                <Sub>
                  {item.variant_label} · {item.region_name}
                </Sub>
              </Cell>
              <Cell className="text-right">{item.quantity}</Cell>
              <Cell className="whitespace-nowrap text-right">{formatUsd(item.total_price_cents)}</Cell>
              <Cell>
                <span className="flex flex-wrap gap-1">
                  {item.status === 'refunded' ? <Chip tone="mute">Refunded</Chip> : null}
                  {item.status === 'unavailable' ? <Chip tone="bad">Unavailable · to refund</Chip> : null}
                  {p && item.status === 'active' ? <Chip tone={PICKUP_STATUS[p.status][1]}>{PICKUP_STATUS[p.status][0]}</Chip> : null}
                  {p?.status === 'picked' ? p.payout_id ? <Chip tone="ok">Paid to shop</Chip> : <Chip tone="warn">Not paid yet</Chip> : null}
                  {p?.arrived_at ? <Chip tone="brand">In the US</Chip> : null}
                  {!p && item.status === 'active' ? <span className="text-ink-muted text-[13px]">After cutoff</span> : null}
                </span>
                {refund !== undefined ? (
                  <span className="mt-2 block">
                    <ConfirmButton
                      label={`Refund ${formatUsd(refund)}…`}
                      title={`Refund ${formatUsd(refund)}?`}
                      confirm={`Refund ${formatUsd(refund)}`}
                      action={refundItemAction.bind(null, order.id, item.id)}
                      mail={{
                        subject: `Your refund for order ${order.order_number}`,
                        text: `We've refunded ${formatUsd(order.refunded_cents + refund)} to your card so far. Banks usually take 5 to 10 days to show it.`,
                      }}
                    >
                      For <b>{item.product_name}</b> ({item.variant_label}, no longer available) on order {order.order_number}: its price and its
                      share of the tax. Stripe sends it to the card first; then the order shows it.
                    </ConfirmButton>
                  </span>
                ) : null}
                {expressInIndia && p?.status === 'pending' ? (
                  <span className="mt-2 flex gap-2">
                    <form action={markExpressPickupAction.bind(null, p.id, 'picked', order.id)}>
                      <button type="submit" className={button}>
                        Picked
                      </button>
                    </form>
                    <form action={markExpressPickupAction.bind(null, p.id, 'unavailable', order.id)}>
                      <button type="submit" className={secondaryButton}>
                        Unavailable
                      </button>
                    </form>
                  </span>
                ) : null}
              </Cell>
              <Cell>
                {p?.vendor?.shop_name ?? '—'}
                {p ? <Sub>{rupees(p.shop_price_paise)}</Sub> : null}
              </Cell>
            </tr>
          );
        })}
      </Table>
    </Panel>
  );
}
