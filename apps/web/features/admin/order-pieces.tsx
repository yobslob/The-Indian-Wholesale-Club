import Image from 'next/image';

import { PIECE_STAGE, pieceStage } from '@repo/shared/admin';
import { formatUsd } from '@repo/shared/domain';
import { siteLabel } from '@repo/shared/sourcing';

import { mediaUrl } from '@/lib/site';

import { markExpressPickupAction } from './actions/orders';
import { refundItemAction } from './actions/refunds';
import { Chip } from './chips';
import { ConfirmButton } from './confirm';
import { PickedWeightInput, WeighPicked } from './hub-weigh';
import { PieceOrdering } from './piece-ordering';
import { button, Cell, Panel, rupees, secondaryButton, Sub, Table } from './ui';

import type { getAdminOrder } from '@repo/db/admin';

type Order = NonNullable<Awaited<ReturnType<typeof getAdminOrder>>>;

/**
 * The order's pieces (D-096): photo, piece, quantity, price, where it stands (to order, ordered, at the hub, paid to
 * the shop, in the US, D-140) and the shop with its price. A piece from an online shop is ordered from here: Order it ↗
 * opens the shop item in use and Mark ordered records it (F3). An unavailable piece gets its refund here (it asks first); an express order's
 * pieces and the made-to-order pilot's are marked picked here (D-070, D-115), weighed if the desk types a weight (D-130).
 */
export function OrderPieces({
  order,
  refunds,
  pickHere,
  costs,
}: {
  order: Order;
  refunds: Map<string, number>;
  pickHere: boolean;
  /** D-140 (F4): each piece's landed cost and margin. */
  costs?: Map<string, { costCents: number | null; marginPct: number | null }>;
}): React.JSX.Element {
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
          const itemUrl = p?.source?.item_url ?? item.product?.source_url ?? null;
          const site = p?.source?.site ?? item.product?.source_site ?? null;
          const stage = p ? pieceStage(p, Boolean(itemUrl)) : null;
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
                  {[item.variant_label, item.region_name].filter(Boolean).join(' · ')}
                </Sub>
              </Cell>
              <Cell className="text-right">{item.quantity}</Cell>
              <Cell className="whitespace-nowrap text-right">
                {formatUsd(item.total_price_cents)}
                {costs?.get(item.id)?.costCents != null ? (
                  <Sub>
                    cost {formatUsd(costs.get(item.id)!.costCents!)}
                    {costs.get(item.id)!.marginPct !== null ? ` · ${costs.get(item.id)!.marginPct}%` : ''}
                  </Sub>
                ) : null}
              </Cell>
              <Cell>
                <span className="flex flex-wrap gap-1">
                  {item.status === 'refunded' ? <Chip tone="mute">Refunded</Chip> : null}
                  {item.status === 'unavailable' ? <Chip tone="bad">Unavailable · to refund</Chip> : null}
                  {stage && item.status === 'active' ? <Chip tone={PIECE_STAGE[stage][1]}>{PIECE_STAGE[stage][0]}</Chip> : null}
                  {p?.status === 'picked' ? p.payout_id ? <Chip tone="ok">Paid to shop</Chip> : <Chip tone="warn">Not paid yet</Chip> : null}
                  {p?.arrived_at ? <Chip tone="brand">In the US</Chip> : null}
                  {!p && item.status === 'active' ? <span className="text-ink-muted text-[13px]">After cutoff</span> : null}
                </span>
                {p && p.status === 'pending' && item.status === 'active' && itemUrl ? (
                  <PieceOrdering
                    pickupId={p.id}
                    orderId={order.id}
                    itemUrl={itemUrl}
                    site={site ? siteLabel(site) : null}
                    quantity={item.quantity}
                    soldPaise={p.shop_price_paise ?? item.shop_price_paise}
                    nowPaise={p.source?.price_paise ?? null}
                    inStock={p.source?.in_stock ?? null}
                    deliveryDays={p.source?.delivery_days ?? null}
                    ordered={p.ordered_at ? { paidPaise: p.paid_paise, ref: p.shop_order_ref } : null}
                  />
                ) : null}
                {p?.status === 'picked' ? (
                  <span className="mt-1.5 block">
                    <WeighPicked pickupId={p.id} weighedG={p.weighed_g} note={p.weigh_note} label={item.product_name} path={`/admin/orders/${order.id}`} />
                  </span>
                ) : null}
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
                {pickHere && p?.status === 'pending' ? (
                  <span className="mt-2 flex gap-2">
                    <form action={markExpressPickupAction.bind(null, p.id, 'picked', order.id)} className="flex gap-1.5">
                      <PickedWeightInput label={item.product_name} />
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
                {site ? siteLabel(site) : (p?.vendor?.shop_name ?? '—')}
                {p ? <Sub>{p.paid_paise !== null ? `${rupees(p.paid_paise)} paid` : `${rupees(p.shop_price_paise)} a piece`}</Sub> : null}
              </Cell>
            </tr>
          );
        })}
      </Table>
    </Panel>
  );
}
