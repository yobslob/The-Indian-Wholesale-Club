import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { button, escapeHtml, frame, paragraph, pieces, type EmailContext } from './frame';
import { arrives, piecesOf, shipmentOf } from './shipments';

import type { OrderDetail } from '@repo/db/store';

/**
 * The email for one customer-visible order update (flows.md §8, B-20), in the D-094 frame: the subject as its heading,
 * the missing pieces' photos when one is unavailable, and the shipped email's button to our order page (where "Track
 * the parcel" goes on to the carrier, D-088). Built ONLY from the customer-safe order shape
 * (guest_order_lookup), so nothing operational can reach it (D-003): no shops, pickups, exports or cycles, and no
 * reason why a date moved. Every dynamic value is escaped. Copy follows storefront.md §Voice (D-059); D-161 rewrote it
 * in the homesick plan's words (no new emails); the founder may rewrite any of it. Pure, so it has unit tests (tests/order-update.test.ts).
 */

export interface OrderUpdateEmail {
  subject: string;
  html: string;
}

interface Parts {
  subject: string;
  paragraphs: string[];
  link?: { href: string; label: string };
  /** Pieces drawn with their photos above the text (D-094). */
  show?: OrderDetail['items'];
}

const strong = (text: string): string => `<strong>${escapeHtml(text)}</strong>`;

/** D-154: the update is about one of two shipments; it names it and shows its pieces. */
function shipmentParts(kind: string, order: OrderDetail, orderUrl: string, seq: number | null | undefined): Parts | null {
  const sh = shipmentOf(order, seq);
  if (!sh) return null;
  const n = order.order.order_number;
  const view = { href: orderUrl, label: 'See your order' };
  const show = piecesOf(order, sh);
  const other = order.shipments.find((s) => s.seq !== sh.seq);
  const actions = order.actions;
  switch (kind) {
    case 'shipped':
      return {
        subject: `Shipment ${sh.seq} of order ${n} is on its way home`,
        show,
        paragraphs: [
          `Out the door and headed to yours.${arrives(sh) ? ` It ${strong(arrives(sh)!.replace(/^Arrives/, 'arrives'))}.` : ''}`,
          other?.status === 'open' ? `The rest travels on its own; we'll email you when it ships.` : '',
        ],
        link: { href: orderUrl, label: 'Track your order' },
      };
    case 'delivered':
      return {
        subject: `Shipment ${sh.seq} of order ${n} has landed`,
        show,
        paragraphs: [`This part of your order is at your door. We hope it smells right.`],
        link: view,
      };
    case 'delivery_window_changed': {
      const when = arrives(sh);
      const open = actions?.delay_open && actions.delay_shipment === sh.seq && actions.delay_refund_cents !== null;
      return {
        subject: `New delivery date for shipment ${sh.seq} of order ${n}`,
        show,
        paragraphs: [
          when ? `This part of your order now ${strong(when.replace(/^Arrives/, 'arrives'))}, later than we said. That's on us.` : `Its delivery date has changed. That's on us.`,
          open
            ? `If that doesn't work for you, you can cancel this part and get ${strong(formatUsd(actions.delay_refund_cents!))} back, or keep it with the new date. It's your call, on your order page.`
            : '',
          `The rest of your order keeps its date.`,
        ],
        link: open ? { href: orderUrl, label: 'Keep it or cancel' } : view,
      };
    }
    case 'shipment_cancelled':
      return {
        subject: `Shipment ${sh.seq} of order ${n} is cancelled`,
        show,
        paragraphs: [
          `This part of your order is cancelled.`,
          order.order.refunded_cents > 0
            ? `We've refunded ${strong(formatUsd(order.order.refunded_cents))} to your card so far. Banks usually take 5 to 10 days to show it.`
            : '',
          other && other.status !== 'cancelled' ? `The rest of your order is still coming.` : '',
        ],
        link: view,
      };
    default:
      return null;
  }
}

function parts(kind: string, order: OrderDetail, orderUrl: string): Parts | null {
  const o = order.order;
  const n = o.order_number;
  const window =
    o.est_delivery_from && o.est_delivery_to ? formatDeliveryWindow(o.est_delivery_from, o.est_delivery_to) : null;
  const view = { href: orderUrl, label: 'See your order' };
  const actions = order.actions;

  switch (kind) {
    case 'preparing':
      return {
        subject: `We're packing order ${n}`,
        paragraphs: [`Your list is with us, and we're getting everything together.`, window ? `Still landing ${strong(window)}.` : ''],
        link: view,
      };
    case 'item_unavailable': {
      const gone = order.items.filter((i) => i.status === 'unavailable').map((i) => `${i.product_name} (${i.variant_label})`);
      return {
        subject: `One piece of order ${n} couldn't make the trip`,
        show: order.items.filter((i) => i.status === 'unavailable'),
        paragraphs: [
          `${gone.length ? strong(gone.join(', ')) : 'One of your pieces'} has sold out. We're sorry.`,
          `You won't pay for it: we're refunding it, and you'll get an email when the money is on its way.`,
          `Everything else is still coming.`,
        ],
        link: view,
      };
    }
    case 'item_refunded':
      return {
        subject: `Order ${n}: your money's on its way back`,
        paragraphs: [
          `${strong(formatUsd(o.refunded_cents))} is going back to your card. Banks take 5 to 10 days to show it. We wish they didn't.`,
        ],
        link: view,
      };
    case 'order_cancelled':
      return {
        subject: `Order ${n} is cancelled`,
        paragraphs: [
          o.refunded_cents > 0
            ? `Done, and ${strong(formatUsd(o.refunded_cents))} is on its way back to your card. Banks take 5 to 10 days to show it.`
            : `Done. Your order is cancelled.`,
          `We'll be here next time you miss home.`,
        ],
        link: view,
      };
    case 'return_requested':
      return {
        subject: `Your return for order ${n}: we'll come to your door for it`,
        paragraphs: [
          `We got your return request. We'll collect it from your door, just like the delivery.`,
          `Your refund goes out once it reaches us. Banks usually take 5 to 10 days to show it.`,
        ],
        link: view,
      };
    case 'return_rejected':
      return {
        subject: `About your return for order ${n}`,
        paragraphs: [`We couldn't accept this return. Reply to this email and we'll talk it through.`],
        link: view,
      };
    case 'delivery_window_changed':
      return {
        subject: `New date for order ${n}. Sorry.`,
        paragraphs: [
          window ? `It now lands ${strong(window)}, later than we said. That's on us.` : `Your delivery date has changed. That's on us.`,
          actions?.delay_open && actions.delay_refund_cents !== null
            ? `If that doesn't work for you, you can cancel and get all ${strong(formatUsd(actions.delay_refund_cents))} back, or keep it with the new date. It's your call, on your order page.`
            : '',
        ],
        link: actions?.delay_open ? { href: orderUrl, label: 'Keep it or cancel' } : view,
      };
    case 'faster_delivery_offer':
      return order.offer
        ? {
            subject: `Order ${n} can reach you sooner`,
            paragraphs: [
              `Good news: your order can arrive ${strong(formatDeliveryWindow(order.offer.est_delivery_from, order.offer.est_delivery_to))} instead.`,
              `That's ${strong(formatUsd(order.offer.price_cents))} if you want it. Or do nothing, and it still arrives by the date we gave you.`,
            ],
            link: { href: orderUrl, label: 'Get it sooner' },
          }
        : null;
    case 'faster_delivery_accepted':
      return {
        subject: `Faster delivery added to order ${n}`,
        paragraphs: [window ? `Done. Your order should reach you ${strong(window)}.` : `Done. Your order is coming sooner.`],
        link: view,
      };
    case 'arriving_sooner':
      return {
        subject: `Plot twist: order ${n} is early`,
        paragraphs: [`It's already on its way, arriving ahead of the date we gave you.`],
        link: view,
      };
    case 'shipped':
      // D-094: the button opens our order page, which links on to the carrier (D-066, D-088).
      return {
        subject: `Order ${n} is on its way home`,
        paragraphs: [`Out the door and headed to yours.${window ? ` At your door ${strong(window)}.` : ''}`],
        link: { href: orderUrl, label: 'Track your order' },
      };
    case 'delivered':
      return {
        subject: `Home has landed: order ${n}`,
        paragraphs: [`Your parcel is at your door. We hope it smells right.`],
        link: view,
      };
    default:
      return null;
  }
}

/** Null for kinds that send no email. `shipment`: the update is about that shipment (D-154). */
export function orderUpdateEmail(kind: string, order: OrderDetail, ctx: EmailContext, shipment?: number | null): OrderUpdateEmail | null {
  const n = order.order.order_number;
  const orderUrl = `${ctx.siteUrl}/orders/${encodeURIComponent(n)}`;
  const p = shipmentParts(kind, order, orderUrl, shipment) ?? parts(kind, order, orderUrl);
  if (!p) return null;
  const body = [
    p.show && p.show.length > 0 ? `${pieces(p.show, ctx)}<div style="height:14px"></div>` : '',
    ...p.paragraphs.filter(Boolean).map(paragraph),
    p.link ? button(p.link.href, p.link.label) : '',
  ].join('\n');
  return { subject: p.subject, html: frame(ctx, { title: p.subject, orderLine: `Order ${n}`, heading: p.subject, body }) };
}
