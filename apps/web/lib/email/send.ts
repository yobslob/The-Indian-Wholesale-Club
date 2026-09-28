import 'server-only';

import { Resend } from 'resend';

import { claimEmail, lookupGuestOrder, markEmailFailed, markEmailSent } from '@repo/db/server';

import { supportEmail } from '@/lib/env';
import { errorMessage, logger } from '@/lib/logger';
import { SITE_NAME } from '@/lib/site';

import { orderConfirmationHtml, orderConfirmationSubject } from './order-confirmation';

import type { IwcClient } from '@repo/db';

let resend: Resend | null = null;

function mailer(): { client: Resend; from: string } | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return null;
  resend ??= new Resend(key);
  return { client: resend, from };
}

export interface OutboxRow {
  id: string;
  kind: string;
  recipient: string;
  payload: unknown;
  attempts: number;
}

/**
 * Sends one email_outbox row after claiming it (so two runs never send it twice).
 * Unconfigured email (no RESEND_API_KEY / RESEND_FROM_EMAIL) leaves the row
 * pending, so nothing is lost; the outbox job sends it once email is configured.
 */
export async function deliverOutboxRow(
  service: IwcClient,
  row: OutboxRow,
): Promise<'sent' | 'failed' | 'skipped'> {
  const mail = mailer();
  if (!mail) {
    logger.warn('email.not_configured', { outboxId: row.id, kind: row.kind });
    return 'skipped';
  }
  if (!(await claimEmail(service, row.id))) return 'skipped';
  try {
    const payload = row.payload as { orderNumber?: unknown };
    if (row.kind !== 'order_confirmation' || typeof payload.orderNumber !== 'string') {
      throw new Error(`Unsupported outbox row (${row.kind})`);
    }
    const order = await lookupGuestOrder(service, payload.orderNumber, row.recipient);
    if (!order) throw new Error('Order not found for outbox row');
    const result = await mail.client.emails.send({
      from: mail.from,
      to: [row.recipient],
      subject: orderConfirmationSubject(order, SITE_NAME),
      html: orderConfirmationHtml(order, SITE_NAME, supportEmail()),
    });
    if (result.error) throw new Error(result.error.message);
    await markEmailSent(service, row.id, result.data?.id ?? null);
    return 'sent';
  } catch (error) {
    logger.error('email.send_failed', { outboxId: row.id, error: errorMessage(error) });
    await markEmailFailed(service, row.id, row.attempts, errorMessage(error));
    return 'failed';
  }
}
