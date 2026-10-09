import Link from 'next/link';
import { notFound } from 'next/navigation';

import { cancelRefundCents, exportCancelCents, getAdminOrder, itemRefundCents, listCycles, listOrderMoves } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { cancelAfterExportAction } from '@/features/admin/actions/after-sales';
import { addNoteAction, changeWindowAction } from '@/features/admin/actions/orders';
import { cancelOrderAction } from '@/features/admin/actions/refunds';
import { Chip, ORDER_STATUS, PAYMENT_STATUS } from '@/features/admin/chips';
import { ConfirmButton, FormButton } from '@/features/admin/confirm';
import { requireAdminPage } from '@/features/admin/guard';
import { adminEventText } from '@/features/admin/order-events';
import { canMove, MoveOrderButton, MovesList } from '@/features/admin/order-move-form';
import { OrderPieces } from '@/features/admin/order-pieces';
import { ShipForm, shipState } from '@/features/admin/ship-form';
import { dateRange } from '@/features/admin/time';
import { dangerButton, Field, input, PageHead, Panel, rupees, When } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

const WINDOW_CAN_MOVE = ['confirmed', 'collecting', 'packed', 'in_transit', 'arrived'];

/**
 * An order (D-096): the order on the left (pieces with photos and pickup state, the customer with tap-to-call, the
 * timeline in plain words with what the customer sees marked); on the right only the actions possible now, the main
 * one first, and the money. Every refund and cancel asks first, with the exact amount and the customer's email.
 */
export default async function AdminOrderPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await getAdminOrder(client, id);
  if (!order) notFound();
  const n = order.order_number;
  const address = order.shipping_address as Record<string, string | null>;
  // Refund amounts come from the database rules (D-042), shown before anyone clicks.
  const unavailable = order.items.filter((i) => i.status === 'unavailable');
  const [itemRefunds, cancelAmounts, exportCancel, cycles, moves] = await Promise.all([
    Promise.all(unavailable.map(async (i) => [i.id, await itemRefundCents(client, i.id)] as const)),
    order.status === 'confirmed'
      ? Promise.all([cancelRefundCents(client, order.id, 'customer_request'), cancelRefundCents(client, order.id, 'our_fault')])
      : null,
    // D-072: after it left India, customer care cancels with the shipping deduction.
    ['in_transit', 'arrived', 'shipped'].includes(order.status) ? exportCancelCents(client, order.id) : null,
    listCycles(client, 12),
    listOrderMoves(client, order.id),
  ]);
  const events = [...order.events].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const { canShip, express } = shipState(order);
  const expressInIndia = express && ['confirmed', 'collecting'].includes(order.status);
  const cancelMail = (amount: number) => ({
    subject: `Order ${n} is cancelled`,
    text: `Your order is cancelled.${amount > 0 ? ` ${formatUsd(order.refunded_cents + amount)} is on its way back to your card. Banks usually take 5 to 10 days to show it.` : ''}`,
  });
  // What the shops are owed for this order's picked pieces, and how much of it is paid (quantity × shop price, as record_payout counts).
  const picked = order.items.flatMap((i) => (i.pickup && i.pickup.status === 'picked' ? [{ ...i.pickup, owed: i.quantity * (i.pickup.shop_price_paise ?? 0) }] : []));
  const shopTotal = picked.reduce((s, p) => s + p.owed, 0);
  const shopPaid = picked.filter((p) => p.payout_id).reduce((s, p) => s + p.owed, 0);
  const main = canShip || order.status === 'shipped';

  return (
    <>
      <PageHead
        back={{ href: '/admin/orders', label: 'Orders' }}
        code
        title={`Order ${n}`}
        sub={
          <>
            <Chip tone={ORDER_STATUS[order.status][1]}>{ORDER_STATUS[order.status][0]}</Chip>
            <Chip tone={PAYMENT_STATUS[order.payment_status][1]}>{PAYMENT_STATUS[order.payment_status][0]}</Chip>
            <Chip tone={order.shipping_method === 'express' ? 'brand' : 'mute'}>{order.shipping_method === 'express' ? 'Express' : 'Standard'}</Chip>
            <span>
              · placed <When iso={order.created_at} inline />
              {order.cycle ? (
                <>
                  {' '}
                  · cycle{' '}
                  <Link href={`/admin/cycles/${order.cycle.id}`} className="text-ink font-semibold">
                    {order.cycle.code}
                  </Link>
                </>
              ) : null}
            </span>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
          <OrderPieces order={order} refunds={new Map(itemRefunds)} expressInIndia={expressInIndia} />
          <Panel title="Customer">
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-[14px] leading-[1.4] md:grid-cols-[110px_1fr]">
              <dt className="text-ink-muted">Name</dt>
              <dd>{address.fullName ?? '—'}</dd>
              <dt className="text-ink-muted">Email</dt>
              <dd>
                <a href={`mailto:${order.email}`} className="break-all font-semibold">
                  {order.email}
                </a>
              </dd>
              <dt className="text-ink-muted">Phone</dt>
              <dd>
                {address.phone ? (
                  <a href={`tel:${address.phone.replace(/[^\d+]/g, '')}`} className="font-semibold">
                    {address.phone}
                  </a>
                ) : (
                  '—'
                )}
              </dd>
              <dt className="text-ink-muted">Ship to</dt>
              <dd>{[address.line1, address.line2, address.city, [address.state, address.zipCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</dd>
              <dt className="text-ink-muted">Promised</dt>
              <dd>{dateRange(order.est_delivery_from, order.est_delivery_to)}</dd>
              {order.tracking_number ? (
                <>
                  <dt className="text-ink-muted">Tracking</dt>
                  <dd>
                    {order.carrier} · {order.tracking_number}
                  </dd>
                </>
              ) : null}
            </dl>
          </Panel>
          <Panel
            title="Timeline"
            note={
              <>
                <span className="text-brand">●</span> = the customer sees it
              </>
            }
          >
            <ul>
              {events.map((e) => {
                const { text, note } = adminEventText(e);
                return (
                  <li key={e.id} className="border-line grid grid-cols-[1fr] gap-1 border-b py-2 text-[13.5px] leading-[1.4] last:border-0 md:grid-cols-[190px_18px_1fr] md:gap-2">
                    <time className="text-ink-muted text-[12.5px]">
                      <When iso={e.created_at} inline />
                    </time>
                    <span className="text-brand hidden md:block" aria-label={e.visible_to_customer ? 'The customer sees it' : undefined}>
                      {e.visible_to_customer ? '●' : ''}
                    </span>
                    <span>
                      {e.visible_to_customer ? <span className="text-brand md:hidden">● </span> : null}
                      {text}
                      {note ? <span className="text-caution block">{note}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
            <MovesList moves={moves} />
          </Panel>
        </div>

        <div className="grid gap-4 lg:sticky lg:top-[78px]">
          <Panel>
            {main ? <ShipForm order={order} /> : null}
            {!main && expressInIndia ? (
              <p className="text-[14px]">Express: mark each piece picked on the left, then pack and ship it by courier from India.</p>
            ) : null}
            <div className={main || expressInIndia ? 'border-line mt-4 border-t pt-4' : ''}>
              <h3 className="mb-2.5 text-[14px] font-semibold">{main || expressInIndia ? 'More' : 'Actions'}</h3>
              <div className="grid gap-2">
                {WINDOW_CAN_MOVE.includes(order.status) ? (
                  <FormButton
                    label="New delivery date…"
                    title="New delivery date"
                    submit="Change window"
                    action={changeWindowAction.bind(null, order.id)}
                    mail={{
                      subject: `New delivery date for order ${n}`,
                      text: 'It gives the new dates; when they are later, the customer can keep the order or cancel it for everything back.',
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
                ) : null}
                <FormButton label="Add internal note…" title="Internal note" submit="Add note" action={addNoteAction.bind(null, order.id)}>
                  <Field label="Never shown to the customer">
                    <textarea name="note" required rows={3} className={`${input} h-auto py-2`} />
                  </Field>
                </FormButton>
                {canMove(order, cycles) ? <MoveOrderButton order={order} cycles={cycles} /> : null}
                {cancelAmounts ? (
                  <>
                    <ConfirmButton
                      label={`Cancel, the customer asked: refund ${formatUsd(cancelAmounts[0])}…`}
                      className={`${dangerButton} w-full whitespace-normal py-2 text-left md:h-auto`}
                      title={`Cancel and refund ${formatUsd(cancelAmounts[0])}?`}
                      confirm={`Cancel and refund ${formatUsd(cancelAmounts[0])}`}
                      action={cancelOrderAction.bind(null, order.id, 'customer_request')}
                      mail={cancelMail(cancelAmounts[0])}
                    >
                      Order {n}, before cutoff, because the customer asked: everything back except the tax. Its pieces go back on sale.
                    </ConfirmButton>
                    <ConfirmButton
                      label={`Cancel because of us: refund ${formatUsd(cancelAmounts[1])}…`}
                      className={`${dangerButton} w-full whitespace-normal py-2 text-left md:h-auto`}
                      title={`Cancel and refund ${formatUsd(cancelAmounts[1])}?`}
                      confirm={`Cancel and refund ${formatUsd(cancelAmounts[1])}`}
                      action={cancelOrderAction.bind(null, order.id, 'our_fault')}
                      mail={cancelMail(cancelAmounts[1])}
                    >
                      Order {n}, before cutoff, because of us: everything back. Its pieces go back on sale.
                    </ConfirmButton>
                  </>
                ) : null}
                {exportCancel !== null ? (
                  <ConfirmButton
                    label={`Cancel for the customer: refund ${formatUsd(exportCancel)}…`}
                    className={`${dangerButton} w-full whitespace-normal py-2 text-left md:h-auto`}
                    title={`Cancel and refund ${formatUsd(exportCancel)}?`}
                    confirm={`Cancel and refund ${formatUsd(exportCancel)}`}
                    action={cancelAfterExportAction.bind(null, order.id)}
                    mail={cancelMail(exportCancel)}
                  >
                    Order {n} has left India. Only when the customer asked customer care: the shipping deduction is kept and its pieces become US
                    clearance drafts.
                  </ConfirmButton>
                ) : null}
              </div>
            </div>
          </Panel>
          <Panel title="Money">
            <dl className="grid gap-1.5 text-[14px] leading-[1.3] [&>div]:flex [&>div]:justify-between [&_dd]:m-0 [&_dt]:text-ink-muted">
              <div>
                <dt>Subtotal</dt>
                <dd>{formatUsd(order.subtotal_cents)}</dd>
              </div>
              {order.discount_cents > 0 ? (
                <div>
                  <dt>Discount</dt>
                  <dd>−{formatUsd(order.discount_cents)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Shipping</dt>
                <dd>{order.shipping_cents === 0 ? 'Free' : formatUsd(order.shipping_cents)}</dd>
              </div>
              <div>
                <dt>Sales tax</dt>
                <dd>{formatUsd(order.tax_cents)}</dd>
              </div>
              <div className="border-line border-t pt-2 text-[16px] font-bold [&>dt]:!text-ink">
                <dt>Total paid</dt>
                <dd>{formatUsd(order.total_cents)}</dd>
              </div>
              {order.refunded_cents > 0 ? (
                <div>
                  <dt>Refunded</dt>
                  <dd>−{formatUsd(order.refunded_cents)}</dd>
                </div>
              ) : null}
              {picked.length > 0 ? (
                <div>
                  <dt>Shops paid</dt>
                  <dd>
                    {rupees(shopPaid)} of {rupees(shopTotal)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
