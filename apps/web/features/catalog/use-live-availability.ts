'use client';

import { useEffect, useState } from 'react';

import { browserClient } from '@/lib/supabase/browser';

/**
 * Live "available" per variant (flows.md §9, D-010, PR-7). Starts from the
 * cached page data, refreshes once on mount, then follows Realtime changes of
 * the public variant_availability table for this product only.
 */
export function useLiveAvailability(
  productId: string,
  initial: Record<string, number>,
): Record<string, number> {
  const [available, setAvailable] = useState(initial);

  useEffect(() => {
    const client = browserClient();
    let active = true;

    void client
      .from('variant_availability')
      .select('variant_id, available')
      .eq('product_id', productId)
      .then(({ data }) => {
        if (!active || !data) return;
        setAvailable((prev) => ({
          ...prev,
          ...Object.fromEntries(data.map((r) => [r.variant_id, r.available])),
        }));
      });

    const channel = client
      .channel(`availability:${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'variant_availability',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          const row = payload.new as { variant_id?: string; available?: number };
          if (row.variant_id && typeof row.available === 'number') {
            setAvailable((prev) => ({
              ...prev,
              [row.variant_id as string]: row.available as number,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [productId]);

  return available;
}
