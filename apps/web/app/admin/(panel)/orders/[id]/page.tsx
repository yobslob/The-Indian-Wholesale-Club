import { notFound } from 'next/navigation';

import {
  cancelRefundCents,
  getAdminOrder,
  itemRefundCents,
  listCycles,
  listOrderMoves,
} from '@repo/db/admin';
import { formatUsd, orderEventLabel } from '@repo/shared/domain';

import {
  addNoteAction,
  changeWindowAction,
  markDeliveredAction,
  markShippedAction,
} from '@/features/admin/actions/orders';
import { cancelOrderAction, refundItemAction } from '@/features/admin/actions/refunds';
import { requireAdminPage } from '@/features/admin/guard';
import { OrderMoveForm } from '@/features/admin/order-move-form';
import { button, Cell, Field, input, PageTitle, Table, utc } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

/** Order detail: items with pickup state, full internal timeline, pack & ship, delivery window. */
export default async function AdminOrderPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await getAdminOrder(client, id);
  if (!order) notFound();
  const address = order.shipping_address as Record<string, string | null>;
  // Refund amounts come from the database rules (D-042), shown before anyone clicks.
  const unavailable = order.items.filter((i) => i.status === 'unavailable');
  const [itemRefunds, cancelAmounts, cycles, moves] = await Promise.all([
    Promise.all(unavailable.map(async (i) => [i.id, await itemRefundCents(client, i.id)] as const)),
    order.status === 'confirmed'
      ? Promise.all([
          cancelRefundCents(client, order.id, 'customer_request'),
          cancelRefundCents(client, order.id, 'our_fault'),
        ])
      : null,
    listCycles(client, 12),
    listOrderMoves(client, order.id),
  ]);
  const refundFor = new Map(itemRefunds);
  const events = [...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="space-y-6">
      <PageTitle>Order {order.order_number}</PageTitle>
      <p>
        {order.email} · {order.status} · payment {order.payment_status} · placed{' '}
        {utc(order.created_at)} · total {formatUsd(order.total_cents)} · {order.shipping_method}{' '}
        shipping
        {order.refunded_cents > 0 ? ` · refunded ${formatUsd(order.refunded_cents)}` : ''}
      </p>
      <p>
        Promised window: {order.est_delivery_from ?? '—'} → {order.est_delivery_to ?? '—'}
        {order.carrier ? ` · ${order.carrier} ${order.tracking_number ?? ''}` : ''}
      </p>
      <p className="text-ink-muted">
        Ship to:{' '}
        {[
          address.fullName,
          address.line1,
          address.line2,
          address.city,
          address.state,
          address.zipCode,
          address.phone,
        ]
          .filter(Boolean)
          .join(', ')}
      </p>

      <Table head={['Item', 'Qty', 'Price', 'Item status', 'Pickup']}>
        {order.items.map((item) => (
          <tr key={item.id}>
            <Cell>
              {item.product_name} · {item.variant_label} · {item.region_name}
            </Cell>
            <Cell>{item.quantity}</Cell>
            <Cell>{formatUsd(item.total_price_cents)}</Cell>
            <Cell className={item.status === 'unavailable' ? 'text-caution' : ''}>
              {item.status}
              {refundFor.has(item.id) ? (
                <form action={refundItemAction.bind(null, order.id, item.id)} className="mt-1">
                  <button type="submit" className={button}>
                    Refund {formatUsd(refundFor.get(item.id) ?? 0)}
                  </button>
                </form>
              ) : null}
            </Cell>
            <Cell>
              {item.pickup ? `${item.pickup.status}${item.pickup.payout_id ? ' · paid' : ''}` : '—'}
            </Cell>
          </tr>
        ))}
      </Table>

      <div className="grid gap-6 lg:grid-cols-3">
        <OrderMoveForm order={order} cycles={cycles} moves={moves} />
        <form
          action={markShippedAction.bind(null, order.id)}
          className="border-line space-y-2 rounded-md border p-3"
        >
          <h2 className="font-medium">Pack &amp; ship</h2>
          <Field label="Carrier">
            <input name="carrier" required className={input} />
          </Field>
          <Field label="Tracking number">
            <input name="tracking" required className={input} />
          </Field>
          <button type="submit" className={button}>
            Mark shipped
          </button>
        </form>

        <form
          action={changeWindowAction.bind(null, order.id)}
          className="border-line space-y-2 rounded-md border p-3"
        >
          <h2 className="font-medium">New delivery estimate</h2>
          <p className="text-ink-muted text-xs">
            The customer is notified and may cancel for a full refund (D-008).
          </p>
          <Field label="From">
            <input name="from" type="date" required className={input} />
          </Field>
          <Field label="To">
            <input name="to" type="date" required className={input} />
          </Field>
          <Field label="Internal note">
            <input name="note" className={input} />
          </Field>
          <button type="submit" className={button}>
            Change window
          </button>
        </form>

        <div className="border-line space-y-3 rounded-md border p-3">
          {cancelAmounts ? (
            <div className="space-y-2">
              <h2 className="font-medium">Cancel (before cutoff, D-042)</h2>
              <form action={cancelOrderAction.bind(null, order.id, 'customer_request')}>
                <button type="submit" className="min-h-11 underline">
                  Customer asked to cancel: refund {formatUsd(cancelAmounts[0])} (tax kept)
                </button>
              </form>
              <form action={cancelOrderAction.bind(null, order.id, 'our_fault')}>
                <button type="submit" className="min-h-11 underline">
                  Cancel because of us: refund {formatUsd(cancelAmounts[1])}
                </button>
              </form>
            </div>
          ) : null}
          <form action={markDeliveredAction.bind(null, order.id)}>
            <button type="submit" className={button}>
              Mark delivered
            </button>
          </form>
          <form action={addNoteAction.bind(null, order.id)} className="space-y-2">
            <Field label="Internal note (never shown to the customer)">
              <textarea name="note" required rows={3} className={input} />
            </Field>
            <button type="submit" className={button}>
              Add note
            </button>
          </form>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Timeline</h2>
        <ul className="space-y-1">
          {events.map((e) => (
            <li key={e.id}>
              {utc(e.created_at)} · {e.kind}
              {e.visible_to_customer
                ? ` (customer sees: “${orderEventLabel(e.kind)}”)`
                : ' (internal)'}
              {e.message ? ` · ${e.message}` : ''}
              {e.internal_note ? ` · note: ${e.internal_note}` : ''}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
