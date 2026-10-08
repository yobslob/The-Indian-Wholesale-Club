import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import { button, escapeHtml, frame, paragraph, pieces, type EmailContext } from './frame';

import type { OrderDetail } from '@repo/db/store';

/**
 * The email for one customer-visible order update (flows.md §8, B-20), in the D-094 frame: the subject as its heading,
 * the missing pieces' photos when one is unavailable, and the shipped email's button to our order page (where "Track
 * the parcel" goes on to the carrier, D-088). Built ONLY from the customer-safe order shape
 * (guest_order_lookup), so nothing operational can reach it (D-003): no shops, pickups, exports or cycles, and no
 * reason why a date moved. Every dynamic value is escaped. Copy follows design.md §Voice (D-059); the founder may
 * rewrite any of it. Pure, so it has unit tests (tests/order-update.test.ts).
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
        subject: `We're getting order ${n} ready`,
        paragraphs: [
          `Your order is with us now and we're getting it ready to come over.`,
          window ? `It should reach you ${strong(window)}.` : '',
        ],
        link: view,
      };
    case 'item_unavailable': {
      const gone = order.items.filter((i) => i.status === 'unavailable').map((i) => `${i.product_name} (${i.variant_label})`);
      return {
        subject: `Sorry, part of order ${n} isn't coming`,
        show: order.items.filter((i) => i.status === 'unavailable'),
        paragraphs: [
          `${gone.length ? strong(gone.join(', ')) : 'One of your pieces'} is no longer available. We're sorry.`,
          `You don't pay for it: we're refunding it, and you'll get an email when the money is on its way.`,
          `Everything else in your order is still coming.`,
        ],
        link: view,
      };
    }
    case 'item_refunded':
      return {
        subject: `Your refund for order ${n}`,
        paragraphs: [
          `We've refunded ${strong(formatUsd(o.refunded_cents))} to your card so far. Banks usually take 5 to 10 days to show it.`,
        ],
        link: view,
      };
    case 'order_cancelled':
      return {
        subject: `Order ${n} is cancelled`,
        paragraphs: [
          `Your order is cancelled.`,
          o.refunded_cents > 0
            ? `${strong(formatUsd(o.refunded_cents))} is on its way back to your card. Banks usually take 5 to 10 days to show it.`
            : '',
        ],
        link: view,
      };
    case 'return_requested':
      return {
        subject: `Your return for order ${n}`,
        paragraphs: [
          `We got your return request. We'll be in touch to collect it from your door, just like the delivery.`,
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
        subject: `New delivery date for order ${n}`,
        paragraphs: [
          window ? `Your order now arrives ${strong(window)}, later than we first said. We're sorry.` : `Your delivery date has changed.`,
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
        subject: `Order ${n} is coming sooner than we said`,
        paragraphs: [`Nice surprise: your order is already on its way, ahead of the date we gave you.`],
        link: view,
      };
    case 'shipped':
      // D-094: the button opens our order page, which links on to the carrier (D-066, D-088).
      return {
        subject: `Order ${n} is on its way`,
        paragraphs: [`Your order has left us and is on its way to you.`],
        link: { href: orderUrl, label: 'Track your order' },
      };
    case 'delivered':
      return {
        subject: `Order ${n} is delivered`,
        paragraphs: [`Your order has been delivered. We hope it feels a little like home.`],
        link: view,
      };
    default:
      return null;
  }
}

/** Null for kinds that send no email. */
export function orderUpdateEmail(kind: string, order: OrderDetail, ctx: EmailContext): OrderUpdateEmail | null {
  const n = order.order.order_number;
  const orderUrl = `${ctx.siteUrl}/orders/${encodeURIComponent(n)}`;
  const p = parts(kind, order, orderUrl);
  if (!p) return null;
  const body = [
    p.show && p.show.length > 0 ? `${pieces(p.show, ctx)}<div style="height:14px"></div>` : '',
    ...p.paragraphs.filter(Boolean).map(paragraph),
    p.link ? button(p.link.href, p.link.label) : '',
  ].join('\n');
  return { subject: p.subject, html: frame(ctx, { title: p.subject, orderLine: `Order ${n}`, heading: p.subject, body }) };
}
