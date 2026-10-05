import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { OrderActions } from '@repo/db/store';

import { Body, Button, ErrorText } from '@/components/ui';
import { apiPost } from '@/lib/api';

/**
 * As on the website (flows.md §7, §7b): after a delay, keep the order or cancel for everything back (D-008); before
 * cutoff, cancel for all but the tax (D-042). Same server API; cancelling asks once more.
 */
export function OrderChoices({
  actions,
  orderNumber,
  email,
  window,
  onChanged,
}: {
  actions: OrderActions;
  orderNumber: string;
  email: string;
  window: { from: string; to: string } | null;
  onChanged?: () => void;
}): React.JSX.Element | null {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const refund = formatUsd((actions.delay_open ? actions.delay_refund_cents : actions.cancel_refund_cents) ?? 0);
  if (!actions.delay_open && !actions.can_cancel) return null;

  async function decide(choice: 'cancel' | 'keep'): Promise<void> {
    setBusy(true);
    setError(null);
    const res = await apiPost<{ ok: true }>('/api/orders/choice', { orderNumber, email, choice });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(choice === 'keep' ? 'Thanks. Your order stays with the new date.' : 'Your order is cancelled. The refund is on its way.');
    onChanged?.();
  }

  return (
    <View className="border-line gap-3 rounded-lg border p-4">
      <Text className="font-ui text-ink text-[15px]">
        {actions.delay_open ? 'Your delivery date moved' : 'Changed your mind?'}
      </Text>
      <Body>
        {actions.delay_open
          ? `${window ? `It now arrives ${formatDeliveryWindow(window.from, window.to)}. ` : ''}Keep your order with the new date, or cancel and get all ${refund} back. Sorry about this.`
          : `You can cancel until we start preparing your order. You'd get ${refund} back: everything except the tax.`}
      </Body>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {done ? (
        <Body>{done}</Body>
      ) : (
        <View className="gap-2">
          {actions.delay_open ? (
            <Button label="Keep my order" disabled={busy} onPress={() => void decide('keep')} />
          ) : null}
          {confirming ? (
            <Button
              kind="secondary"
              label={busy ? 'Cancelling…' : `Yes, cancel and refund ${refund}`}
              disabled={busy}
              onPress={() => void decide('cancel')}
            />
          ) : (
            <Button kind="link" label="Cancel my order" disabled={busy} onPress={() => setConfirming(true)} />
          )}
        </View>
      )}
    </View>
  );
}
