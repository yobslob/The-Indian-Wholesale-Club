import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { markOrderDelivered, markOrderShipped } from '@repo/db/admin';
import { CARRIERS } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { AdminButton, Sheet } from './ui';

import { ErrorText } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export interface ShipTarget {
  id: string;
  number: string;
  name: string;
}

const chip = (on: boolean): string => `min-h-10 justify-center rounded-pill border px-3 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`;
const input = 'border-line bg-paper text-ink font-body min-h-11 rounded-[10px] border px-3 text-[15px]';

/** Each order on its own: one that fails doesn't stop the rest, and the admin sees which. */
async function each(ids: string[], run: (id: string) => Promise<void>): Promise<string[]> {
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await run(id);
    } catch {
      failed.push(id);
    }
  }
  void apiPost('/admin/revalidate', {});
  return failed;
}

/**
 * Pack & ship (D-097): one order or several at once, a carrier and tracking number each (D-066: USPS, UPS, FedEx and
 * DHL give the customer a tracking link; another carrier is typed). The database checks each order may ship.
 */
export function ShipSheet({ open, orders, onClose, onDone }: { open: boolean; orders: ShipTarget[]; onClose: () => void; onDone: (failed: string[]) => void }): React.JSX.Element {
  const [lines, setLines] = useState<Record<string, { carrier: string; other: string; tracking: string }>>({});
  const [busy, setBusy] = useState(false);
  const line = (id: string) => lines[id] ?? { carrier: CARRIERS[0], other: '', tracking: '' };
  const set = (id: string, patch: Partial<{ carrier: string; other: string; tracking: string }>) => setLines((l) => ({ ...l, [id]: { ...line(id), ...patch } }));
  const ready = orders.every((o) => {
    const l = line(o.id);
    return l.tracking.trim().length >= 4 && (l.carrier !== 'Other' || l.other.trim().length >= 2);
  });

  async function ship(): Promise<void> {
    setBusy(true);
    const failed = await each(
      orders.map((o) => o.id),
      (id) => {
        const l = line(id);
        return markOrderShipped(supabase, id, l.carrier === 'Other' ? l.other.trim() : l.carrier, l.tracking.trim());
      },
    );
    setBusy(false);
    setLines({});
    onDone(failed);
  }

  return (
    <Sheet open={open} onClose={onClose} title={orders.length === 1 ? 'Pack & ship' : `Mark ${orders.length} shipped`}>
      <Text className="font-body text-ink-muted text-[14px] leading-5">Each customer is emailed a link to their order page with the tracking number.</Text>
      {orders.map((o) => (
        <View key={o.id} className="border-line gap-2 border-t pt-3">
          <Text className="font-ui-semibold text-ink text-[14px]">
            {o.number}
            {o.name ? <Text className="font-ui text-ink-muted"> · {o.name}</Text> : null}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {[...CARRIERS, 'Other'].map((c) => (
              <Pressable key={c} onPress={() => set(o.id, { carrier: c })} className={chip(line(o.id).carrier === c)} accessibilityRole="button" accessibilityState={{ selected: line(o.id).carrier === c }}>
                <Text className={`font-ui text-[14px] ${line(o.id).carrier === c ? 'text-paper' : 'text-ink'}`}>{c}</Text>
              </Pressable>
            ))}
          </View>
          {line(o.id).carrier === 'Other' ? (
            <TextInput value={line(o.id).other} onChangeText={(t) => set(o.id, { other: t })} placeholder="Carrier's name" placeholderTextColor={tokens.colors['ink-muted']} accessibilityLabel={`Carrier for ${o.number}`} className={input} />
          ) : null}
          <TextInput
            value={line(o.id).tracking}
            onChangeText={(t) => set(o.id, { tracking: t })}
            placeholder="Tracking number"
            placeholderTextColor={tokens.colors['ink-muted']}
            accessibilityLabel={`Tracking number for ${o.number}`}
            autoCapitalize="characters"
            className={input}
          />
        </View>
      ))}
      <AdminButton big label={busy ? 'Marking…' : orders.length === 1 ? 'Mark shipped' : `Mark ${orders.length} shipped`} disabled={busy || !ready} onPress={() => void ship()} />
      <AdminButton big kind="secondary" label="Not yet" onPress={onClose} />
    </Sheet>
  );
}

/** Mark delivered (D-097): asks first, since each customer is emailed that it arrived. */
export function DeliverSheet({ open, orders, onClose, onDone }: { open: boolean; orders: ShipTarget[]; onClose: () => void; onDone: (failed: string[]) => void }): React.JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open={open} onClose={onClose} title={orders.length === 1 ? 'Mark delivered?' : `Mark ${orders.length} delivered?`}>
      <Text className="font-body text-ink-muted text-[14px] leading-5">
        {orders.map((o) => o.number).join(', ')}. Each customer is emailed that it arrived.
      </Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <AdminButton
        big
        label={busy ? 'Marking…' : orders.length === 1 ? 'Mark delivered' : `Mark ${orders.length} delivered`}
        disabled={busy}
        onPress={() =>
          void (async () => {
            setBusy(true);
            setError(null);
            const failed = await each(
              orders.map((o) => o.id),
              (id) => markOrderDelivered(supabase, id),
            );
            setBusy(false);
            onDone(failed);
          })()
        }
      />
      <AdminButton big kind="secondary" label="Not yet" onPress={onClose} />
    </Sheet>
  );
}
