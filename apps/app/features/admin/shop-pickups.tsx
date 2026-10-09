import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { markPickup, type listPickups } from '@repo/db/admin';
import { deskTime, type Desk } from '@repo/shared/admin';

import { rupees } from './format';
import { AdminButton, Chip, ConfirmSheet } from './ui';

import { Photo } from '@/components/photo';
import { supabase } from '@/lib/supabase';

type Pickup = Awaited<ReturnType<typeof listPickups>>[number];

/** Picked (green), unavailable (red) and the rest still to pick, as one bar. */
export function Progress({ done, gone, total }: { done: number; gone: number; total: number }): React.JSX.Element {
  const pct = (n: number): `${number}%` => `${total ? (n / total) * 100 : 0}%`;
  return (
    <View className="bg-line h-2 flex-1 flex-row overflow-hidden rounded">
      <View className="bg-positive" style={{ width: pct(done) }} />
      <View className="bg-danger" style={{ width: pct(gone) }} />
    </View>
  );
}

const digits = (n: string | null | undefined): string => (n ?? '').replace(/[^\d+]/g, '');

/**
 * One shop's pickups (D-097): Call, WhatsApp, Map, how far along, and a big Picked / Unavailable per piece (Unavailable
 * asks first: the customer is emailed). The database moves the stock and the order (flows.md §4).
 */
export function ShopCard({
  rows,
  desk,
  busy,
  run,
}: {
  rows: Pickup[];
  desk: Desk | null;
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<boolean>;
}): React.JSX.Element {
  const [asking, setAsking] = useState<Pickup | null>(null);
  const v = rows[0]?.vendor;
  const done = rows.filter((p) => p.status === 'picked').length;
  const gone = rows.filter((p) => p.status === 'unavailable').length;
  const place = [v?.address, v?.town, v?.region?.name, 'India'].filter(Boolean).join(', ');
  return (
    <View className="border-line bg-paper overflow-hidden rounded-[14px] border">
      <View className="gap-2.5 px-4 pb-3 pt-3.5">
        <View>
          <Text className="font-heading-semibold text-ink text-[16px]">{v?.shop_name ?? 'Unknown shop'}</Text>
          <Text className="font-body text-ink-muted text-[13px]">{[v?.town, v?.region?.name, v?.payment_method].filter(Boolean).join(' · ')}</Text>
        </View>
        <View className="flex-row gap-2">
          {v?.phone ? (
            <View className="flex-1">
              <AdminButton kind="secondary" icon="call-outline" label="Call" onPress={() => void Linking.openURL(`tel:${digits(v.phone)}`)} />
            </View>
          ) : null}
          {v?.whatsapp || v?.phone ? (
            <View className="flex-1">
              <AdminButton
                kind="secondary"
                icon="logo-whatsapp"
                label="WhatsApp"
                onPress={() => void Linking.openURL(`https://wa.me/${digits(v.whatsapp ?? v.phone).replace('+', '')}`)}
              />
            </View>
          ) : null}
          <View className="flex-1">
            <AdminButton
              kind="secondary"
              icon="location-outline"
              label="Map"
              onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v?.shop_name ?? ''}, ${place}`)}`)}
            />
          </View>
        </View>
        <View className="flex-row items-center gap-2.5">
          <Text className="font-ui-semibold text-ink text-[12.5px]">
            {done} of {rows.length} picked{gone ? ` · ${gone} unavailable` : ''}
          </Text>
          <Progress done={done} gone={gone} total={rows.length} />
        </View>
      </View>
      {rows.map((p) => {
        const media = p.variant?.product?.media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
        return (
          <View
            key={p.id}
            className={`border-line gap-2.5 border-t px-4 py-2.5 ${p.status === 'picked' ? 'bg-[rgba(22,101,52,0.04)]' : p.status === 'unavailable' ? 'bg-[rgba(185,28,28,0.04)]' : ''}`}
          >
            <View className="flex-row items-center gap-3">
              <View className="bg-land h-[54px] w-10 overflow-hidden rounded-lg">{media ? <Photo path={media.storage_path} width={40} /> : null}</View>
              <View className="min-w-0 flex-1">
                <Text className="font-ui-semibold text-ink text-[14px]">{p.item?.product_name ?? 'Piece'}</Text>
                <Text className="font-body text-ink-muted text-[12.5px]">
                  {p.variant?.label ?? p.item?.variant_label} × {p.quantity} · {rupees(p.shop_price_paise)} · {p.item?.order?.order_number}
                </Text>
              </View>
            </View>
            {p.status === 'pending' ? (
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <AdminButton big label="Picked" disabled={busy} onPress={() => void run(() => markPickup(supabase, p.id, 'picked'))} />
                </View>
                <View className="flex-1">
                  <AdminButton big kind="secondary" label="Unavailable" disabled={busy} onPress={() => setAsking(p)} />
                </View>
              </View>
            ) : p.status === 'picked' ? (
              <Chip tone="ok">{`Picked${p.picked_at ? ` ${deskTime(p.picked_at, desk).main.split(', ')[1]}` : ''}`}</Chip>
            ) : (
              <Chip tone="bad">Unavailable</Chip>
            )}
          </View>
        );
      })}
      <ConfirmSheet
        open={asking !== null}
        title={`${asking?.item?.product_name ?? 'This piece'}: unavailable?`}
        confirm="Mark unavailable"
        busy={busy}
        onClose={() => setAsking(null)}
        onConfirm={() => void run(() => markPickup(supabase, asking!.id, 'unavailable')).then(() => setAsking(null))}
      >
        The shop doesn&apos;t have it any more. The piece leaves the order and the customer is emailed that it isn&apos;t coming;
        refund it on the web panel.
      </ConfirmSheet>
    </View>
  );
}
