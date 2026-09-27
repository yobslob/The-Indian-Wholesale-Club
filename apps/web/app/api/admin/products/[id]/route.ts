import { NextResponse, type NextRequest } from 'next/server';

import { adminUpdateProductSchema } from '@repo/shared/schemas';

import { requireAdmin } from '@/lib/auth/admin';
import { deleteAdminProduct, updateAdminProduct } from '@/lib/queries/admin';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = adminUpdateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid product data', details: parsed.error.format() },
        { status: 400 },
      );
    }

    const result = await updateAdminProduct(id, parsed.data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update product' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API /admin/products/[id]] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const result = await deleteAdminProduct(id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete product' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API /admin/products/[id]] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}

