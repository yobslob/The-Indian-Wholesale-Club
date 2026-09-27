import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/auth/admin';
import { getAdminCategories } from '@/lib/queries/admin';

export async function GET(): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const categories = await getAdminCategories();
    return NextResponse.json(categories);
  } catch (err) {
    console.error('[API /admin/categories] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}
