import { Text } from 'react-native';

import { listRegionsAdmin, listVendors } from '@repo/db/admin';

import { Body, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { VendorForm } from '@/features/admin/vendor-form';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Vendors (India desk): the shops IWC buys from. Admin-only data (D-003); never on a customer surface. */
export default function AdminVendorsScreen(): React.JSX.Element {
  const { data, error, loading, reload } = useQuery('admin:vendors', async () => {
    const [vendors, regions] = await Promise.all([
      listVendors(supabase),
      listRegionsAdmin(supabase),
    ]);
    return { vendors, regions: regions.map((r) => ({ id: r.id, name: r.name })) };
  });

  return (
    <Screen title="Vendors" refreshing={loading} onRefresh={reload}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.vendors.length === 0 ? <Body muted>No shops yet.</Body> : null}
      {data?.vendors.map((v) => (
        <Card key={v.id}>
          <Text className="text-ink font-medium">
            {v.shop_name}
            {v.is_placeholder ? ' (placeholder)' : ''}
          </Text>
          <Body muted>
            {[v.region?.name, v.town, v.phone ?? v.whatsapp, v.status].filter(Boolean).join(' · ')}
          </Body>
        </Card>
      ))}
      {data ? <VendorForm regions={data.regions} onDone={reload} /> : null}
    </Screen>
  );
}
