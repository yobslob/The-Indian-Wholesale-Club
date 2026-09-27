import { NextResponse, type NextRequest } from 'next/server';

import { adminUpdateOrderStatusSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import { getAdminOrderDetail, updateAdminOrderStatus } from '@/lib/queries/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const order = await getAdminOrderDetail(id);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error('[API /admin/orders/[id]] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch order detail' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const parsed = adminUpdateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await updateAdminOrderStatus(id, parsed.data);
    if (!result.success) {
      // Invalid state transitions are client conflicts (409), not server
      // faults; surface the real reason to the admin UI (L8).
      return NextResponse.json(
        { error: result.error || 'Failed to update order status' },
        { status: result.conflict ? 409 : 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API /admin/orders/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
