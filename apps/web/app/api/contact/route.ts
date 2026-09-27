import { NextResponse } from 'next/server';
import { z } from 'zod';

import { SUPPORT_EMAIL } from '@repo/shared/constants';

import { getFromAddress, resend } from '@/lib/email/resend';
import { logger } from '@/lib/logger';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  subject: z.string().min(2, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = contactSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid contact submission', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { name, email, subject, message } = parsed.data;

    // Forward notification to support team when Resend is configured (J1)
    if (resend) {
      const fromAddress = getFromAddress('orders');
      if (!fromAddress) {
        logger.error('contact.forward_skipped', { reason: 'RESEND_FROM_EMAIL missing' });
      } else {
        try {
          await resend.emails.send({
            from: fromAddress,
            to: [SUPPORT_EMAIL],
            replyTo: email,
            subject: `[Client Inquiry] ${subject} - ${name}`,
            text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\nMessage:\n${message}`,
          });
          logger.info('contact.forwarded', { to: SUPPORT_EMAIL, subject });
        } catch (emailErr) {
          // No persistence table exists - keep the full payload in the logs
          // so the inquiry is recoverable instead of silently dropped (H8)
          logger.error('contact.forward_failed', {
            name,
            email,
            subject,
            message,
            reason: emailErr instanceof Error ? emailErr.message : 'unknown',
          });
        }
      }
    } else {
      logger.warn('contact.forward_not_configured', { reason: 'RESEND_API_KEY missing' });
    }

    return NextResponse.json({
      success: true,
      message: 'Inquiry received. Our concierge team will reply within 24 hours.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit inquiry';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
