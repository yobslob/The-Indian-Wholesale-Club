import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { listAdminProducts } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Body, Card, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { rupees } from '@/features/admin/format';
import { QtyConfirm } from '@/features/admin/qty-confirm';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const STATUSES: Enum<'product_status'>[] = ['draft', 'live', 'paused'];

/**
 * Listings (India desk): drafts to review and quantities to confirm with the
 * shops. Adding a product with the camera, editing and publishing are on the
 * web panel for now (camera upload is a coding-phase feature, admin.md).
 */
export default function AdminListingsScreen(): React.JSX.Element {
  const [status, setStatus] = useState<Enum<'product_status'>>('draft');
  const { data, error, loading, reload } = useQuery(`admin:listings:${status}`, () =>
    listAdminProducts(supabase, { status, limit: 50 }),
  );

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Title>Listings</Title>
      <View className="flex-row gap-2">
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            className={`min-h-11 justify-center rounded-sm border px-3 ${s === status ? 'border-ink' : 'border-line'}`}
          >
            <Text className={s === status ? 'text-ink text-sm' : 'text-ink-muted text-sm'}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data && data.length === 0 ? <Body muted>No {status} listings.</Body> : null}
      {data?.map((p) => (
        <Card key={p.id}>
          <Text className="text-ink font-medium">{p.name}</Text>
          <Body muted>
            {[
              p.region?.name,
              p.vendor?.shop_name,
              formatUsd(p.price_cents),
              `shop ${rupees(p.shop_price_paise)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Body>
          {p.variants.length === 0 ? (
            <Body muted>No variants yet (add them on the web panel).</Body>
          ) : null}
          {p.variants
            .filter((v) => v.is_active)
            .map((v) => (
              <QtyConfirm
                key={`${v.id}:${v.qty_listed}:${v.qty_confirmed_at ?? ''}`}
                variant={v}
                onDone={reload}
              />
            ))}
        </Card>
      ))}
    </Screen>
  );
}
