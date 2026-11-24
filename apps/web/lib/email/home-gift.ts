import { formatInr, formatUsd } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from '@/features/send-home/words';

import { button, escapeHtml, frame, paragraph, small, type EmailContext } from './frame';

import type { OrderDetail } from '@repo/db/store';

/**
 * D-205, Send home's two emails (plan §5): it reached them, with the UPI reference's last four; or it could not be sent
 * and the gift's dollars are back on the card. Built only from the customer-safe order shape (D-003), every value escaped.
 */
export function homeGiftEmail(
  kind: 'home_gift_sent' | 'home_gift_failed',
  order: OrderDetail,
  ctx: EmailContext,
): { subject: string; html: string } | null {
  const gift = order.home_gift;
  if (!gift) return null;
  const W = SEND_HOME_WORDS.emails;
  const inr = formatInr(gift.inr_paise);
  const n = order.order.order_number;
  const sent = kind === 'home_gift_sent';
  const subject = sent ? W.sentSubject(inr, gift.call_name) : W.failedSubject(inr, gift.call_name);
  const body = [
    paragraph(
      escapeHtml(sent ? W.sentBody(inr, gift.call_name, gift.utr_last4) : W.failedBody(inr, gift.call_name, formatUsd(gift.usd_cents))),
    ),
    gift.so_far.times > 1 && sent
      ? small(escapeHtml(`${SEND_HOME_WORDS.postcard.soFar}: ${formatInr(gift.so_far.inr_paise)}`))
      : '',
    button(`${ctx.siteUrl}/orders/${encodeURIComponent(n)}`, 'See your order'),
  ].join('\n');
  return { subject, html: frame(ctx, { title: subject, orderLine: `Order ${n}`, heading: sent ? 'Sent home' : 'Back on your card', body }) };
}
