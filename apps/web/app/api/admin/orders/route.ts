import { NextResponse, type NextRequest } from 'next/server';

import { requireAdmin } from '@/lib/auth/admin';
import { getAdminOrders } from '@/lib/queries/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '15', 10);

    const result = await getAdminOrders({
      search,
      status,
      paymentStatus,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API /admin/orders] error:', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
