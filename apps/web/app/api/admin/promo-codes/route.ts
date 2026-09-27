import { NextResponse, type NextRequest } from 'next/server';

import { adminCreatePromoCodeSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import {
  createAdminPromoCode,
  getAdminPromoCodes,
  togglePromoCodeStatus,
} from '@/lib/queries/admin';

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const promoCodes = await getAdminPromoCodes();
    return NextResponse.json(promoCodes);
  } catch (err) {
    console.error('[API /admin/promo-codes] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch promo codes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = adminCreatePromoCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await createAdminPromoCode(parsed.data);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create promo code' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, promoId: result.promoId }, { status: 201 });
  } catch (err) {
    console.error('[API /admin/promo-codes] POST error:', err);
    return NextResponse.json({ error: 'Failed to create promo code' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { id, isActive } = body as { id: string; isActive: boolean };

    if (!id || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid payload: id and isActive (boolean) required' },
        { status: 400 },
      );
    }

    const result = await togglePromoCodeStatus(id, isActive);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update promo code' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, id, isActive });
  } catch (err) {
    console.error('[API /admin/promo-codes] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update promo status' }, { status: 500 });
  }
}
