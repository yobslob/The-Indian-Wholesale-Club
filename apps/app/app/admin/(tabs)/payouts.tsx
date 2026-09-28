import { listAllPayablePickups } from '@repo/db/admin';

import type { PayableGroup } from '@/features/admin/payout-card';

import { Body, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { PayoutCard } from '@/features/admin/payout-card';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Payouts (India desk): what each shop is owed for picked pieces, and recording the payment. */
export default function AdminPayoutsScreen(): React.JSX.Element {
  const { data, error, loading, reload } = useQuery('admin:payouts', async () => {
    const pickups = await listAllPayablePickups(supabase);
    const groups = new Map<string, PayableGroup>();
    for (const p of pickups) {
      if (!p.vendor) continue;
      const g = groups.get(p.vendor.id) ?? {
        vendorId: p.vendor.id,
        name: p.vendor.shop_name,
        method: p.vendor.payment_method,
        reference: p.vendor.payment_reference,
        pickupIds: [],
        paise: 0,
        lines: [],
      };
      g.pickupIds.push(p.id);
      g.paise += p.quantity * (p.shop_price_paise ?? 0);
      g.lines.push(
        `${p.item?.product_name ?? 'Item'} · ${p.item?.variant_label ?? ''} × ${p.quantity}`,
      );
      groups.set(p.vendor.id, g);
    }
    return [...groups.values()];
  });

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Payouts</Title>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>Nothing to pay right now.</Body> : null}
      {data?.map((g) => (
        <PayoutCard key={`${g.vendorId}:${g.pickupIds.join(',')}`} group={g} onDone={reload} />
      ))}
    </Screen>
  );
}
