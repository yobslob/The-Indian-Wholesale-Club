import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { listAdminProducts, setProductStatus } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import type { Enum } from '@repo/db';

import { Body, Button, Card, ErrorText, Loading, Screen, Title } from '@/components/ui';
import { rupees } from '@/features/admin/format';
import { QtyConfirm } from '@/features/admin/qty-confirm';
import { useAction } from '@/features/admin/use-action';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';

const STATUSES: Enum<'product_status'>[] = ['draft', 'live', 'paused'];

/**
 * Listings (India desk, flows.md §2): a new listing with the camera (C3), drafts to review and publish, and
 * quantities to confirm with the shops. Editing a listing's text stays on the web panel.
 */
export default function AdminListingsScreen(): React.JSX.Element {
  const [status, setStatus] = useState<Enum<'product_status'>>('draft');
  const router = useRouter();
  // 50 at a time with "Show more": hundreds of drafts never load at once.
  const { items: data, error, loading, loadingMore, hasMore, loadMore, reload } = usePagedQuery(
    `admin:listings:${status}`,
    (offset, limit) => listAdminProducts(supabase, { status, offset, limit }),
    50,
  );
  const publish = useAction(reload);

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <Title>Listings</Title>
      <Button label="New listing" onPress={() => router.push('/admin/listing/new')} />
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
      {publish.error ? <ErrorText>{publish.error}</ErrorText> : null}
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
          {p.status === 'draft' && p.product_type === 'spice' ? (
            <Body muted>Spices stay drafts until the FDA question is settled (D-032).</Body>
          ) : null}
          {p.status === 'draft' && p.product_type === 'clothing' ? (
            <Button
              kind="secondary"
              label={publish.busy ? 'Publishing…' : 'Publish to the store'}
              disabled={publish.busy || p.variants.length === 0}
              onPress={() => void publish.run(() => setProductStatus(supabase, p.id, 'live'))}
            />
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
      {hasMore ? (
        <Button kind="secondary" label={loadingMore ? 'Loading…' : 'Show more'} disabled={loadingMore} onPress={loadMore} />
      ) : null}
    </Screen>
  );
}
