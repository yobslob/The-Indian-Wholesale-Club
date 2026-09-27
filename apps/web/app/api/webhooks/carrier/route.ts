import { createHmac, timingSafeEqual } from 'crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { carrierWebhookPayloadSchema } from '@repo/shared/schemas';
import {
  canTransitionOrder,
  mapTrackingMilestoneToOrderStatus,
  sanitizeTrackingEvent,
} from '@repo/shared/utils';

import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Accepts either:
 *  - Authorization: Bearer <secret> (or the raw secret), or
 *  - X-Carrier-Signature: hex HMAC-SHA256 of the raw body using the secret.
 */
function verifyCarrierAuth(headerValue: string, secret: string, rawBody: string): boolean {
  if (!headerValue) return false;
  if (/^[a-f0-9]{64}$/i.test(headerValue)) {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(headerValue.toLowerCase(), expected);
  }
  const token = headerValue.replace(/^Bearer\s+/i, '');
  return safeEqual(token, secret);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 0. Carrier authentication - fail closed (C6)
    const carrierSecret = process.env.CARRIER_WEBHOOK_SECRET;
    if (!carrierSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('carrier.webhook_secret_missing');
        return NextResponse.json(
          { error: 'Carrier webhook is not configured on this server' },
          { status: 503 },
        );
      }
      logger.warn('carrier.webhook_secret_dev_fallback');
    }

    const rawBody = await request.text();

    if (carrierSecret) {
      const authHeader =
        request.headers.get('x-carrier-signature') || request.headers.get('authorization') || '';
      if (!verifyCarrierAuth(authHeader, carrierSecret, rawBody)) {
        return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
      }
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = carrierWebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid carrier webhook payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { trackingNumber, carrier, status, statusDetails, location, timestamp } = parsed.data;

    // 1. Find corresponding order by tracking_code
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, status')
      .eq('tracking_code', trackingNumber)
      .maybeSingle();

    if (orderError || !order) {
      // Unknown tracking number: do not pretend it was recorded, but return 2xx
      // so the carrier does not retry an event we can never apply (D2)
      logger.warn('carrier.order_not_found', {
        trackingNumber,
        recorded: false,
        reason: orderError ? 'query_error' : 'unknown_order',
      });
      return NextResponse.json(
        { success: true, recorded: false, reason: 'order_not_found' },
        { status: 200 },
      );
    }

    // 2. Sanitize through stealth engine
    const sanitized = sanitizeTrackingEvent({
      rawStatus: status,
      rawLocation: location,
      rawDescription: statusDetails,
      eventTimestamp: timestamp,
    });

    // 3. Write into tracking_events - failures are fatal (H4)
    const { error: insertError } = await supabaseAdmin.from('tracking_events').insert({
      order_id: order.id,
      status: sanitized.customerFacingStatus,
      raw_status: status,
      location: sanitized.customerFacingLocation,
      description: sanitized.customerFacingDescription,
      customer_facing_status: sanitized.customerFacingStatus,
      event_timestamp: sanitized.eventTimestamp,
    });

    if (insertError) {
      logger.error('carrier.tracking_insert_failed', { message: insertError.message, trackingNumber });
      return NextResponse.json({ error: 'Failed to record tracking event' }, { status: 500 });
    }

    // 4. Advance order status only if the milestone maps to a status AND the
    //    monotonic transition is valid (C6, H13, D3)
    const nextStatus = mapTrackingMilestoneToOrderStatus(sanitized.customerFacingStatus);

    if (nextStatus && canTransitionOrder(order.status, nextStatus)) {
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: nextStatus,
          carrier: carrier || 'Carrier Partner',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) {
        logger.error('carrier.order_update_failed', { orderId: order.id, message: updateError.message });
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      orderNumber: order.order_number,
      sanitizedStatus: sanitized.customerFacingStatus,
      sanitizedLocation: sanitized.customerFacingLocation,
    });
  } catch (err) {
    logger.error('carrier.webhook_exception', { message: err instanceof Error ? err.message : 'unknown' });
    return NextResponse.json({ error: 'Internal carrier webhook error' }, { status: 500 });
  }
}
