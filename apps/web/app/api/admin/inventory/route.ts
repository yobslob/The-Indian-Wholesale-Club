import { NextResponse, type NextRequest } from 'next/server';

import { adminUpdateStockSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import { getAdminInventory, updateVariantStock } from '@/lib/queries/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);

    const result = await getAdminInventory({
      search,
      lowStockOnly,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API /admin/inventory] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch inventory matrix' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = adminUpdateStockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid stock payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { variantId, inventoryCount, lowStockThreshold } = parsed.data;
    const result = await updateVariantStock(variantId, inventoryCount, lowStockThreshold);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update variant stock' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, variantId, inventoryCount });
  } catch (err) {
    console.error('[API /admin/inventory] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
