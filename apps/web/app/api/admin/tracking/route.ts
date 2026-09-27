import { NextResponse, type NextRequest } from 'next/server';

import { adminCreateTrackingEventSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import { logger } from '@/lib/logger';
import { addAdminTrackingEvent } from '@/lib/queries/admin';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = adminCreateTrackingEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid tracking event payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await addAdminTrackingEvent(parsed.data);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to add tracking event' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, eventId: result.eventId }, { status: 201 });
  } catch (err) {
    logger.error('admin.tracking_post_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to record tracking event' }, { status: 500 });
  }
}
