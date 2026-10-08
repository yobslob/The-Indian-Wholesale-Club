import 'server-only';

import { Resend } from 'resend';

import {
  claimEmail,
  listDueEmails,
  lookupGuestOrder,
  markEmailFailed,
  markEmailSent,
} from '@repo/db/server';

import { siteUrl, supportEmail } from '@/lib/env';
import { errorMessage, logger } from '@/lib/logger';
import { mediaUrl, SITE_NAME } from '@/lib/site';

import { orderConfirmationHtml, orderConfirmationSubject } from './order-confirmation';
import { orderUpdateEmail } from './order-update';
import { isReservedAddress } from './reserved';

import type { EmailContext } from './frame';
import type { IwcClient } from '@repo/db';
import type { OrderDetail } from '@repo/db/store';

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
 * What every email needs from the site: its name and address, the support email, and small photos of the pieces
 * (D-094) through the site's own image resizer (128 px wide, a 56 px photo at 2x) instead of the full-size upload.
 */
function emailContext(): EmailContext {
  const site = siteUrl().replace(/\/$/, '');
  return {
    siteName: SITE_NAME,
    siteUrl: site,
    supportEmail: supportEmail(),
    photo: (path) => `${site}/_next/image?url=${encodeURIComponent(mediaUrl(path))}&w=128&q=75`,
  };
}

/** Subject and body for a row; null for an update that sends no email (it is marked sent and skipped). */
function compose(row: OutboxRow, order: OrderDetail): { subject: string; html: string } | null {
  const ctx = emailContext();
  if (row.kind === 'order_confirmation') {
    return { subject: orderConfirmationSubject(order, SITE_NAME), html: orderConfirmationHtml(order, ctx) };
  }
  const kind = (row.payload as { kind?: unknown }).kind;
  if (row.kind !== 'order_update' || typeof kind !== 'string') throw new Error(`Unsupported outbox row (${row.kind})`);
  return orderUpdateEmail(kind, order, ctx);
}

/**
 * Sends one email_outbox row after claiming it (so two runs never send it twice).
 * Unconfigured email (no RESEND_API_KEY / RESEND_FROM_EMAIL) leaves the row
 * pending, so nothing is lost; the outbox job sends it once email is configured.
 * The order is read fresh when sending, so an update email shows the order as it is now.
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
  if (isReservedAddress(row.recipient)) {
    await markEmailSent(service, row.id, null); // a test address: nothing can ever arrive there
    return 'skipped';
  }
  try {
    const payload = row.payload as { orderNumber?: unknown };
    if (typeof payload.orderNumber !== 'string') throw new Error(`Outbox row without an order (${row.kind})`);
    const order = await lookupGuestOrder(service, payload.orderNumber, row.recipient);
    if (!order) throw new Error('Order not found for outbox row');
    const email = compose(row, order);
    if (!email) {
      await markEmailSent(service, row.id, null);
      return 'skipped';
    }
    const result = await mail.client.emails.send({
      from: mail.from,
      to: [row.recipient],
      subject: email.subject,
      html: email.html,
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

/** Sends what is due now: after the server itself changed an order, so the customer hears at once. Never throws. */
export async function sendDueEmails(service: IwcClient, limit = 20): Promise<void> {
  if (!mailer()) return; // email not configured: everything waits in the outbox, nothing to log per row
  try {
    for (const row of await listDueEmails(service, limit)) await deliverOutboxRow(service, row);
  } catch (error) {
    logger.error('email.flush_failed', { error: errorMessage(error) });
  }
}
