import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import type { OrderDetail } from '@repo/db/store';

import { Body, Button, ErrorText, Field, Screen, Title } from '@/components/ui';
import { OrderView } from '@/features/orders/order-view';
import { apiPost } from '@/lib/api';

/**
 * Guest order tracking: order number + checkout email, answered by the web
 * server's rate-limited /api/orders/lookup (one message for any mismatch).
 */
export default function OrderLookupScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ number?: string; email?: string }>();
  const [orderNumber, setOrderNumber] = useState(params.number ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);

  async function find(numberValue: string, emailValue: string): Promise<void> {
    setError(null);
    if (!numberValue.trim() || !emailValue.trim()) {
      setError('Enter your order number and the email you used at checkout.');
      return;
    }
    setBusy(true);
    const res = await apiPost<OrderDetail>('/api/orders/lookup', {
      orderNumber: numberValue.trim(),
      email: emailValue.trim(),
    });
    setBusy(false);
    if (res.ok) setOrder(res.data);
    else setError(res.error);
  }

  // Straight from checkout (guest): both values are known, so look it up at once.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !params.number || !params.email) return;
    autoRan.current = true;
    void find(params.number, params.email);
  }, [params.number, params.email]);

  if (order) {
    return (
      <Screen>
        <OrderView order={order} />
        <Button kind="link" label="Track another order" onPress={() => setOrder(null)} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Track an order</Title>
      <Body muted>Use the order number from your confirmation email.</Body>
      <Field
        label="Order number"
        placeholder="IWC-260101-0123456789"
        value={orderNumber}
        onChangeText={setOrderNumber}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        label={busy ? 'Looking…' : 'Find my order'}
        onPress={() => void find(orderNumber, email)}
        disabled={busy}
      />
    </Screen>
  );
}
