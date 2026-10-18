import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { itemRefundCents } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { AdminButton, ConfirmSheet } from '@/features/admin/ui';
import { apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * A piece that turned out unavailable, refunded from the app (D-140, plan A5): the amount from the database's rule
 * (D-030, D-042), shown on the button; it asks first; the website's server refunds through Stripe (the key never
 * leaves it), then the database records it. The customer is emailed as from the web panel.
 */
export function RefundPiece({ orderId, itemId, name, onDone }: { orderId: string; itemId: string; name: string; onDone: () => void }): React.JSX.Element {
  const [cents, setCents] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void itemRefundCents(supabase, itemId).then(setCents, () => setCents(null));
  }, [itemId]);
  if (cents === null) return <Text className="font-body text-ink-muted text-[12.5px]">Working out the refund…</Text>;
  return (
    <View className="mt-1 gap-1">
      <AdminButton kind="danger" label={`Refund ${formatUsd(cents)}…`} onPress={() => setAsking(true)} />
      {error ? <Text className="font-body text-danger text-[12.5px]">{error}</Text> : null}
      <ConfirmSheet
        open={asking}
        title={`Refund ${formatUsd(cents)}?`}
        confirm={`Refund ${formatUsd(cents)}`}
        busy={busy}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          setBusy(true);
          setError(null);
          void apiPost<{ ok: true }>('/admin/refund', { orderId, itemId }).then((r) => {
            setBusy(false);
            setAsking(false);
            if (r.ok) onDone();
            else setError(r.error);
          });
        }}
      >
        {name} is no longer available: its price and its share of the tax go back to the customer&apos;s card, and they
        get an email.
      </ConfirmSheet>
    </View>
  );
}
