import React from 'react';

import { getAdminLogisticsOverview } from '@/lib/queries/admin';

import { LogisticsClient } from './logistics-client';

export const dynamic = 'force-dynamic';

export default async function AdminLogisticsPage(): Promise<React.JSX.Element> {
  const { activeShipments, recentEvents, stats } = await getAdminLogisticsOverview();

  return (
    <LogisticsClient
      initialActiveShipments={activeShipments}
      initialRecentEvents={recentEvents}
      stats={stats}
    />
  );
}
