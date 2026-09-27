import { notFound } from 'next/navigation';
import React from 'react';

import { ProductEditForm } from '@/components/admin';
import { getProductById } from '@/lib/queries/products';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProductPage({
  params,
}: EditProductPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const product = await getProductById(supabaseAdmin, id, { includeInactive: true });

  if (!product) {
    notFound();
  }

  return <ProductEditForm product={product} />;
}

