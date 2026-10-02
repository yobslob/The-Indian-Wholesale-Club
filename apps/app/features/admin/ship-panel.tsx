import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { markOrderDelivered, markOrderShipped } from '@repo/db/admin';
import { CARRIERS } from '@repo/shared/domain';

import { Body, Button, Field, Heading } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const chip = (on: boolean): string =>
  `min-h-11 justify-center rounded-pill border px-4 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`;
const chipText = (on: boolean): string => `font-ui text-[14px] ${on ? 'text-canvas' : 'text-ink'}`;

/**
 * flows.md §6.4, as on the website: pack and ship once the export has arrived (USPS, UPS and FedEx give the customer
 * a tracking link, D-066; another carrier is typed), then mark delivered.
 */
export function ShipPanel({
  order,
  busy,
  run,
}: {
  order: {
    id: string;
    status: string;
    carrier: string | null;
    tracking_number: string | null;
    items: { pickup: { status: string; arrived_at: string | null } | null }[];
  };
  busy: boolean;
  run: (task: () => Promise<unknown>) => Promise<boolean>;
}): React.JSX.Element {
  const [carrier, setCarrier] = useState<string>(CARRIERS[0]);
  const [other, setOther] = useState('');
  const [tracking, setTracking] = useState('');
  const name = carrier === 'Other' ? other.trim() : carrier;
  const unchecked = order.items.filter((i) => i.pickup?.status === 'picked' && !i.pickup.arrived_at).length;

  if (order.status === 'shipped') {
    return (
      <View className="gap-2">
        <Heading>Pack &amp; ship</Heading>
        <Body>
          Shipped · {order.carrier} {order.tracking_number}
        </Body>
        <Button
          label="Mark delivered"
          disabled={busy}
          onPress={() => void run(() => markOrderDelivered(supabase, order.id))}
        />
      </View>
    );
  }
  if (order.status !== 'arrived') {
    return (
      <View className="gap-2">
        <Heading>Pack &amp; ship</Heading>
        <Body muted>
          {order.status === 'delivered' ? 'Delivered.' : 'Ships once its export has arrived in the US.'}
        </Body>
      </View>
    );
  }
  return (
    <View className="gap-3">
      <Heading>Pack &amp; ship</Heading>
      {unchecked > 0 ? (
        <Text className="text-caution text-sm">
          {unchecked} piece{unchecked === 1 ? ' is' : 's are'} not checked off as arrived yet.
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {[...CARRIERS, 'Other'].map((c) => (
          <Pressable
            key={c}
            onPress={() => setCarrier(c)}
            className={chip(carrier === c)}
            accessibilityRole="button"
            accessibilityState={{ selected: carrier === c }}
          >
            <Text className={chipText(carrier === c)}>{c}</Text>
          </Pressable>
        ))}
      </View>
      {carrier === 'Other' ? <Field label="Carrier's name" value={other} onChangeText={setOther} /> : null}
      <Field label="Tracking number" value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
      <Button
        label="Mark shipped"
        disabled={busy || name.length < 2 || tracking.trim().length < 4}
        onPress={() => void run(() => markOrderShipped(supabase, order.id, name, tracking.trim()))}
      />
    </View>
  );
}
