import { NextResponse } from 'next/server';

import { validatePromoCode } from '@/lib/queries/orders';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { code, subtotalCents } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { valid: false, message: 'Please enter a promotional code' },
        { status: 400 },
      );
    }

    const subtotal = typeof subtotalCents === 'number' ? subtotalCents : 0;
    const result = await validatePromoCode(supabaseAdmin, code, subtotal);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to validate promo code';
    return NextResponse.json({ valid: false, message }, { status: 500 });
  }
}
