import { NextResponse, type NextRequest } from 'next/server';

import { adminCreateProductSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import { createAdminProduct, getAdminProducts } from '@/lib/queries/admin';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const categoryId = searchParams.get('categoryId') || undefined;
    const isActive = searchParams.get('isActive')
      ? searchParams.get('isActive') === 'true'
      : undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getAdminProducts({
      search,
      categoryId,
      isActive,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API /admin/products] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const parsed = adminCreateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await createAdminProduct(parsed.data);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create product' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, productId: result.productId }, { status: 201 });
  } catch (err) {
    console.error('[API /admin/products] POST error:', err);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
