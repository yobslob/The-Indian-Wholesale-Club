import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/admin';
import { getAdminDashboardStats } from '@/lib/queries/admin';

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const stats = await getAdminDashboardStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error('[API /admin/stats] error:', err);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
