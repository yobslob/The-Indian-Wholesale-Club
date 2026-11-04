import { createContext, useContext, useMemo } from 'react';

import { getStorePolicy } from '@repo/db/store';

import { deliveryDaysLine, type DeliveryLines } from './delivery-days';

import type { ProductType } from '@repo/shared/domain';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const DaysContext = createContext<DeliveryLines>({ food: null, standard: null });

/** Settings' delivery days for every card and screen (D-187): one store_policy() read, the help sheet's own key. */
export function DaysProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { data } = useQuery('store-policy', () => getStorePolicy(supabase));
  const lines = useMemo<DeliveryLines>(
    () => ({
      food: deliveryDaysLine(data?.food_delivery_days_min, data?.food_delivery_days_max),
      standard: deliveryDaysLine(data?.delivery_days_min, data?.delivery_days_max),
    }),
    [data],
  );
  return <DaysContext.Provider value={lines}>{children}</DaysContext.Provider>;
}

/** "7 delivery days" for food, "12 – 16 delivery days" for the rest; null until Settings' days are known. */
export function useDeliveryLine(productType: ProductType): string | null {
  const lines = useContext(DaysContext);
  return productType === 'food' ? lines.food : lines.standard;
}
