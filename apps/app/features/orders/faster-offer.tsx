import { useState } from 'react';
import { Text, View } from 'react-native';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { OrderOffer } from '@repo/db/store';

import { Body, Button, ErrorText } from '@/components/ui';
import { apiPost } from '@/lib/api';
import { SITE_NAME } from '@/lib/site';
import { PaymentSheetError, useStripe } from '@/lib/stripe';

const STRIPE_RETURN_URL = 'iwc://stripe-redirect';

/**
 * D-064, as on the website: the order can arrive sooner for a small price, paid with the payment sheet on the same
 * server API (POST /api/orders/faster, then /confirm). Ignoring it changes nothing. Never says why (D-003).
 */
export function FasterOffer({
  offer,
  orderNumber,
  email,
  onChanged,
}: {
  offer: OrderOffer;
  orderNumber: string;
  email: string;
  onChanged?: () => void;
}): React.JSX.Element {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sooner = formatDeliveryWindow(offer.est_delivery_from, offer.est_delivery_to);

  async function take(): Promise<void> {
    setBusy(true);
    setError(null);
    const started = await apiPost<{ clientSecret: string; paymentIntentId: string }>('/api/orders/faster', {
      orderNumber,
      email,
    });
    if (!started.ok) {
      setBusy(false);
      return setError(started.error);
    }
    const { error: initError } = await initPaymentSheet({
      merchantDisplayName: SITE_NAME,
      paymentIntentClientSecret: started.data.clientSecret,
      returnURL: STRIPE_RETURN_URL,
      defaultBillingDetails: { email },
    });
    if (initError) {
      setBusy(false);
      return setError('Payments are not available right now.');
    }
    const { error: payError } = await presentPaymentSheet();
    if (payError) {
      setBusy(false);
      if (payError.code !== PaymentSheetError.Canceled) setError(payError.message);
      return;
    }
    const confirmed = await apiPost<{ ok: true }>('/api/orders/faster/confirm', {
      paymentIntentId: started.data.paymentIntentId,
    });
    setBusy(false);
    if (!confirmed.ok) return setError(confirmed.error);
    setDone(true);
    onChanged?.();
  }

  return (
    <View className="border-ink gap-3 rounded-lg border p-4">
      {done ? (
        <Body>Done. It should reach you {sooner}.</Body>
      ) : (
        <>
          <Text className="font-ui text-ink text-[15px]">It can reach you sooner</Text>
          <Body>
            Want it {sooner}? That&apos;s {formatUsd(offer.price_cents)}. Or do nothing and it still arrives by the date
            above.
          </Body>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button
            label={busy ? 'One moment…' : `Get it sooner for ${formatUsd(offer.price_cents)}`}
            disabled={busy}
            onPress={() => void take()}
          />
        </>
      )}
    </View>
  );
}
