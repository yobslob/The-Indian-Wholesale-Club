import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatUsd } from '@repo/shared/domain';

import type { OrderDetail, OrderReturnOption } from '@repo/db/store';

import { Body, Button, ErrorText } from '@/components/ui';
import { apiPost } from '@/lib/api';

type Reason = 'damaged' | 'wrong' | 'changed_mind';

const REASON_LABEL: Record<Reason, string> = {
  damaged: 'It arrived damaged',
  wrong: 'It is not what I ordered',
  changed_mind: 'I changed my mind',
};

/**
 * As on the website (D-071): return a delivered piece, the refund for each reason from the database. The money goes
 * back once the piece is received. Same server API; asking asks once more.
 */
export function ReturnChoices({
  returns,
  items,
  orderNumber,
  email,
  onChanged,
}: {
  returns: OrderReturnOption[];
  items: OrderDetail['items'];
  orderNumber: string;
  email: string;
  onChanged?: () => void;
}): React.JSX.Element | null {
  const [picked, setPicked] = useState<{ itemId: string; reason: Reason } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const open = returns.filter((r) => r.requested || r.claim_refund_cents !== null || r.change_of_mind_refund_cents !== null);
  if (open.length === 0) return null;

  const refundFor = (r: OrderReturnOption, reason: Reason): number | null =>
    reason === 'changed_mind' ? r.change_of_mind_refund_cents : r.claim_refund_cents;

  async function ask(itemId: string, reason: Reason): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await apiPost<{ ok: true }>('/api/orders/return', { orderNumber, email, itemId, reason });
    setBusy(false);
    setPicked(null);
    if (!res.ok) return setError(res.error);
    setDone('Thanks. We will email you about sending it back. Your refund goes out once it reaches us.');
    onChanged?.();
  }

  return (
    <View className="border-line gap-3 rounded-lg border p-4">
      <Text className="font-ui text-ink text-[15px]">Return a piece</Text>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {done ? <Body>{done}</Body> : null}
      {open.map((r) => {
        const item = items.find((i) => i.id === r.item_id);
        const reasons = (['damaged', 'wrong', 'changed_mind'] as const).filter((x) => refundFor(r, x) !== null);
        return (
          <View key={r.item_id} className="gap-2">
            <Body>{item ? `${item.product_name} (${item.variant_label})` : 'A piece'}</Body>
            {r.requested ? (
              <Body muted>Return requested. Your refund goes out once it reaches us.</Body>
            ) : picked?.itemId === r.item_id ? (
              <View className="gap-2">
                <Button
                  kind="secondary"
                  label={busy ? 'Sending…' : `Yes, return it for ${formatUsd(refundFor(r, picked.reason) ?? 0)}`}
                  disabled={busy}
                  onPress={() => void ask(r.item_id, picked.reason)}
                />
                <Button kind="link" label="Not now" disabled={busy} onPress={() => setPicked(null)} />
              </View>
            ) : (
              reasons.map((reason) => (
                <Button
                  key={reason}
                  kind="link"
                  label={`${REASON_LABEL[reason]}: ${formatUsd(refundFor(r, reason) ?? 0)} back`}
                  onPress={() => setPicked({ itemId: r.item_id, reason })}
                />
              ))
            )}
          </View>
        );
      })}
      {open.some((r) => r.change_of_mind_refund_cents !== null && !r.requested) ? (
        <Body muted>
          A change of mind is for unworn, unaltered pieces. Part of the price is kept for bringing it back, more as time
          goes on.
        </Body>
      ) : null}
    </View>
  );
}
