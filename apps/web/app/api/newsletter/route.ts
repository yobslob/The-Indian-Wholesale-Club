import { NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase/admin';

const newsletterSchema = z.object({
  email: z.string().email('Valid email address required'),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const json = await req.json();
    const parsed = newsletterSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Persist the subscriber (H14/N12); unique(email) makes repeats a no-op.
    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .upsert({ email, source: 'website' }, { onConflict: 'email', ignoreDuplicates: true });

    if (error) {
      logger.error('newsletter.persist_failed', { message: error.message });
      return NextResponse.json({ error: 'Subscription failed. Please try again.' }, { status: 500 });
    }

    logger.info('newsletter.subscribed', { email });
    return NextResponse.json({
      success: true,
      message: 'Thank you for subscribing to ROOT private drops and announcements.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Subscription failed';
    logger.error('newsletter.exception', { message });
    return NextResponse.json({ error: 'Subscription failed. Please try again.' }, { status: 500 });
  }
}
