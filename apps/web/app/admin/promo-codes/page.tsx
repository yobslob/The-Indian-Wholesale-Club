import React from 'react';

import { getAdminPromoCodes } from '@/lib/queries/admin';

import { PromoCodesClient } from './promo-codes-client';

export const dynamic = 'force-dynamic';

export default async function AdminPromoCodesPage(): Promise<React.JSX.Element> {
  const promoCodes = await getAdminPromoCodes();

  return <PromoCodesClient initialPromoCodes={promoCodes} />;
}
