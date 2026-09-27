import { NextResponse } from 'next/server';

import { getProductImages, getProducts } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim() || '';

  if (!query) {
    return NextResponse.json({ products: [], images: [] });
  }

  try {
    const supabase = await createClient();
    const { products } = await getProducts(supabase, {
      search: query,
      limit: 20,
    });

    const productIds = products.map((p) => p.id);
    const images = await getProductImages(supabase, productIds);

    return NextResponse.json({ products, images });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to search products', products: [], images: [] },
      { status: 500 },
    );
  }
}
