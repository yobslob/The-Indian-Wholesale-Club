import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { formatUsd } from '@repo/shared/domain';

import { Body, Button, Card, Screen, Title } from '@/components/ui';
import { bagSubtotalCents, MAX_QTY_PER_LINE, useBag } from '@/features/cart/store';

/** The bag. Prices are indicative; checkout re-prices on the server. */
export default function BagScreen(): React.JSX.Element {
  const router = useRouter();
  const { lines, setQuantity } = useBag();

  return (
    <Screen>
      <Title>Your bag</Title>
      {lines.length === 0 ? (
        <Body muted>Your bag is empty. Find something from home in Explore.</Body>
      ) : (
        <>
          {lines.map((line) => (
            <Card key={line.variantId}>
              <Text className="text-ink font-medium">{line.productName}</Text>
              <Text className="text-ink-muted text-sm">
                {line.variantLabel} · {line.regionName}
              </Text>
              <View className="flex-row items-center gap-3">
                <Pressable
                  onPress={() => setQuantity(line.variantId, line.quantity - 1)}
                  className="border-line min-h-11 min-w-11 items-center justify-center rounded-sm border"
                  accessibilityLabel={line.quantity === 1 ? 'Remove' : 'One less'}
                >
                  <Text className="text-ink">{line.quantity === 1 ? '×' : '−'}</Text>
                </Pressable>
                <Text className="text-ink w-6 text-center">{line.quantity}</Text>
                <Pressable
                  onPress={() =>
                    setQuantity(line.variantId, Math.min(MAX_QTY_PER_LINE, line.quantity + 1))
                  }
                  className="border-line min-h-11 min-w-11 items-center justify-center rounded-sm border"
                  accessibilityLabel="One more"
                >
                  <Text className="text-ink">+</Text>
                </Pressable>
                <Text className="text-ink ml-auto text-sm">
                  {formatUsd(line.unitPriceCents * line.quantity)}
                </Text>
              </View>
            </Card>
          ))}
          <Body>Subtotal {formatUsd(bagSubtotalCents(lines))}</Body>
          <Body muted>Shipping, tax and delivery dates are shown at checkout.</Body>
          <Button label="Checkout" onPress={() => router.push('/checkout')} />
        </>
      )}
    </Screen>
  );
}
