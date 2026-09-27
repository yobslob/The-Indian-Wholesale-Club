import { Resend } from 'resend';

import { SHIPPING_RATES, SITE_NAME, SUPPORT_EMAIL } from '@repo/shared/constants';
import { formatUSD } from '@repo/shared/utils';

import { logger } from '@/lib/logger';

import type { OrderWithFullDetails } from '@repo/shared/types';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend: Resend | null = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Sender address (H14/J1). RESEND_FROM_EMAIL must be set to a verified
 * custom-domain address in production; development falls back to the
 * resend.dev sandbox so local flows keep working.
 */
export function getFromAddress(fallbackLocalPart = 'orders'): string | null {
  const configured = process.env.RESEND_FROM_EMAIL;
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') {
    logger.error('email.from_address_missing', {
      hint: 'Set RESEND_FROM_EMAIL to a verified custom-domain address',
    });
    return null;
  }

  return `${SITE_NAME} <${fallbackLocalPart}@resend.dev>`;
}

interface SendOrderConfirmationParams {
  toEmail: string;
  order: OrderWithFullDetails;
}

export async function processOrderConfirmationEmail(
  id: string,
  order: OrderWithFullDetails,
  toEmail: string,
): Promise<boolean> {
  const result = await sendOrderConfirmationEmail({ toEmail, order });
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  if (result.success) {
    await supabaseAdmin.from('email_outbox').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: result.id ?? null,
    }).eq('id', id);
    return true;
  }
  const { data: row } = await supabaseAdmin.from('email_outbox').select('attempts').eq('id', id).single();
  const attempts = (row?.attempts ?? 0) + 1;
  await supabaseAdmin.from('email_outbox').update({
    status: attempts >= 5 ? 'dead_letter' : 'pending',
    attempts,
    last_error: result.error ?? 'Email delivery failed',
    next_attempt_at: new Date(Date.now() + Math.min(60 * 60_000, 2 ** attempts * 60_000)).toISOString(),
  }).eq('id', id);
  return false;
}

function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateOrderConfirmationHtml(order: OrderWithFullDetails): string {
  const shippingAddress = (order.shipping_address || {}) as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  const isExpress = order.shipping_cents >= SHIPPING_RATES.express.price * 100;
  const deliveryWindow = isExpress
    ? `${SHIPPING_RATES.express.windowLabel} (Express Priority)`
    : `${SHIPPING_RATES.standard.windowLabel} (Standard Delivery)`;

  const itemsHtml = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 12px 0; font-size: 14px; color: #171717;">
          <div style="font-weight: 600;">${escapeHtml(item.product_name)}</div>
          ${
            item.variant_label
              ? `<div style="font-size: 12px; color: #737373; margin-top: 2px;">${escapeHtml(item.variant_label)}</div>`
              : ''
          }
        </td>
        <td style="padding: 12px 0; text-align: center; font-size: 14px; color: #525252;">
          ${item.quantity}
        </td>
        <td style="padding: 12px 0; text-align: right; font-size: 14px; font-weight: 500; color: #171717;">
          ${formatUSD(item.total_price_cents / 100)}
        </td>
      </tr>
    `,
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation - ${escapeHtml(order.order_number)}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fafafa; margin: 0; padding: 32px 16px;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e5e5; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0; color: #171717;">${escapeHtml(SITE_NAME)}</h1>
            <p style="font-size: 13px; color: #737373; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px;">Order Confirmed</p>
          </div>

          <!-- Order Reference -->
          <div style="background-color: #f5f5f4; border-radius: 6px; padding: 16px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 12px; color: #737373; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
            <div style="font-size: 18px; font-weight: 700; color: #171717; margin-top: 4px; font-family: monospace;">#${escapeHtml(order.order_number)}</div>
          </div>

          <p style="font-size: 14px; line-height: 1.6; color: #404040; margin-bottom: 24px;">
            Thank you for your order. We are carefully preparing your items for shipment. You will receive another notification with your tracking details once your package is on its way.
          </p>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="border-bottom: 2px solid #e5e5e5; text-align: left;">
                <th style="padding-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #737373; font-weight: 600;">Item</th>
                <th style="padding-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #737373; font-weight: 600; text-align: center;">Qty</th>
                <th style="padding-bottom: 8px; font-size: 12px; text-transform: uppercase; color: #737373; font-weight: 600; text-align: right;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Financial Breakdown -->
          <div style="border-top: 1px solid #e5e5e5; padding-top: 16px; margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #525252;">
              <span>Subtotal</span>
              <span>${formatUSD(order.subtotal_cents / 100)}</span>
            </div>
            ${
              order.discount_cents > 0
                ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #b91c1c;">
                    <span>Discount</span>
                    <span>-${formatUSD(order.discount_cents / 100)}</span>
                  </div>`
                : ''
            }
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #525252;">
              <span>Shipping</span>
              <span>${order.shipping_cents === 0 ? 'FREE' : formatUSD(order.shipping_cents / 100)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #525252;">
              <span>Estimated Tax</span>
              <span>${formatUSD(order.tax_cents / 100)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e5e5; font-size: 16px; font-weight: 700; color: #171717;">
              <span>Total</span>
              <span>${formatUSD(order.total_cents / 100)}</span>
            </div>
          </div>

          <!-- Shipping Details (Escaped against HTML injection) -->
          <div style="background-color: #fafafa; border-radius: 6px; padding: 16px; margin-bottom: 32px; font-size: 13px; color: #525252;">
            <div style="font-weight: 600; color: #171717; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Shipping Destination</div>
            <div>${escapeHtml(shippingAddress.fullName)}</div>
            <div>${escapeHtml(shippingAddress.line1)}</div>
            ${shippingAddress.line2 ? `<div>${escapeHtml(shippingAddress.line2)}</div>` : ''}
            <div>${escapeHtml(shippingAddress.city)}, ${escapeHtml(shippingAddress.state)} ${escapeHtml(shippingAddress.zipCode)}</div>
            <div style="margin-top: 8px; color: #737373;">Delivery Window: ${escapeHtml(deliveryWindow)}</div>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #e5e5e5; padding-top: 24px; text-align: center; font-size: 12px; color: #a3a3a3;">
            <p style="margin: 0 0 6px;">Questions regarding your order? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color: #171717; text-decoration: underline;">${SUPPORT_EMAIL}</a>.</p>
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} ${escapeHtml(SITE_NAME)}. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendOrderConfirmationEmail({
  toEmail,
  order,
}: SendOrderConfirmationParams): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!resend) {
    logger.warn('email.skipped_not_configured', {
      reason: 'RESEND_API_KEY missing',
      orderNumber: order.order_number,
      to: toEmail,
    });
    return { success: true, id: 'dev-mode' };
  }

  const fromAddress = getFromAddress('orders');
  if (!fromAddress) {
    return { success: false, error: 'RESEND_FROM_EMAIL is not configured' };
  }

  try {
    const data = await resend.emails.send({
      from: fromAddress,
      to: [toEmail],
      subject: `Order Confirmation #${order.order_number} — ${SITE_NAME}`,
      html: generateOrderConfirmationHtml(order),
    });

    if (data.error) {
      logger.error('email.send_failed', {
        orderNumber: order.order_number,
        to: toEmail,
        code: data.error.name,
        message: data.error.message,
      });
      return { success: false, error: data.error.message };
    }

    logger.info('email.sent', { orderNumber: order.order_number, to: toEmail, id: data.data?.id });
    return { success: true, id: data.data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send confirmation email';
    logger.error('email.send_exception', { orderNumber: order.order_number, to: toEmail, message });
    return { success: false, error: message };
  }
}
