import { notFound } from 'next/navigation';
import React from 'react';

import { getAdminOrderDetail } from '@/lib/queries/admin';

import { OrderDetailClient } from './order-detail-client';

export const dynamic = 'force-dynamic';

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({
  params,
}: OrderDetailPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const order = await getAdminOrderDetail(id);

  if (!order) {
    notFound();
  }

  return <OrderDetailClient initialOrder={order} />;
}
