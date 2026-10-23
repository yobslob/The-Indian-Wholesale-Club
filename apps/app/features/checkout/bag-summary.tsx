import { Text, View } from 'react-native';

import { formatDeliveryWindow, formatUsd } from '@repo/shared/domain';

import type { BagLine } from '@/features/cart/store';
import type { CheckoutQuote } from '@repo/shared/domain';

import { Photo } from '@/components/photo';
import { Row } from '@/components/ui';
import { ChargeRows, ChargeValue, ReducedValue } from '@/features/cart/charges';

/**
 * The bag in checkout and on the thank-you screen (D-087): photos, lines and the subtotal; shipping, tax, the total
 * and the estimated delivery window once the server has priced it (D-008, D-038).
 */
export function BagSummary({ title, lines, quote }: { title: string; lines: BagLine[]; quote: CheckoutQuote | null }): React.JSX.Element {
  const b = quote?.breakdown;
  const subtotal = lines.reduce((n, l) => n + l.unitPriceCents * l.quantity, 0);
  return (
    <View className="bg-surface gap-3 rounded-lg p-[18px]">
      <Text accessibilityRole="header" className="font-heading text-lg text-[#1D1A17]">
        {title}
      </Text>
      {lines.map((l) => {
        const priced = quote?.lines.find((q) => q.variantId === l.variantId)?.totalCents ?? l.unitPriceCents * l.quantity;
        return (
          <View key={l.variantId} className="border-line flex-row items-center gap-3 border-b pb-2.5">
            <View className="bg-land aspect-[3/4] w-14 overflow-hidden rounded-[10px]">{l.imagePath ? <Photo path={l.imagePath} width={56} /> : null}</View>
            <View className="flex-1">
              <Text className="font-ui-semibold text-ink text-sm">{l.productName}</Text>
              <Text className="font-ui text-ink-muted text-[13px]">
                {[l.variantLabel, l.regionName].filter(Boolean).join(' · ')} · × {l.quantity}
              </Text>
            </View>
            <Text className="font-ui text-ink text-sm">{formatUsd(priced)}</Text>
          </View>
        );
      })}
      <Row label="Subtotal" value={formatUsd(b?.subtotalCents ?? subtotal)} />
      {b && quote ? (
        <>
          {b.discountCents > 0 ? <Row label={`Discount (${quote.promoCode ?? ''})`} value={`−${formatUsd(b.discountCents)}`} /> : null}
          {/* D-119: from the free-shipping line up, the bulk saving. */}
          {(b.bulkSavingCents ?? 0) > 0 ? <Row label="Bulk saving" value={`−${formatUsd(b.bulkSavingCents)}`} /> : null}
          {quote.shippingMethod === 'express' ? (
            <Row label="Express shipping" value={formatUsd(b.shippingCents)} />
          ) : (
            <>
              {/* D-111, D-124: Shipping (the parcel + the food in the bag), struck through once free. */}
              <View className="flex-row justify-between gap-3">
                <Text className="font-body text-ink-muted flex-1 text-sm">Shipping</Text>
                <ChargeValue cents={b.shippingCents || (b.waivedCents?.shipping ?? 0)} free={b.shippingCents === 0} />
              </View>
              {b.retailerCents > 0 || (b.waivedCents?.retailer ?? 0) > 0 ? (
                <View className="flex-row justify-between gap-3">
                  <Text className="font-body text-ink-muted flex-1 text-sm">Retailer charges</Text>
                  <ChargeValue cents={b.retailerCents || (b.waivedCents?.retailer ?? 0)} free={b.retailerCents === 0} />
                </View>
              ) : null}
            </>
          )}
          {/* founder 2026-10-24: heavy cookware's other half, on standard and express alike */}
          {(b.heavyCents ?? 0) > 0 ? (
            <View className="flex-row justify-between gap-3">
              <Text className="font-body text-ink-muted flex-1 text-sm">Heavy-item shipping</Text>
              <ReducedValue cents={b.heavyCents} shownCents={b.heavyShownCents ?? 0} />
            </View>
          ) : null}
          <Row label="Sales tax" value={formatUsd(b.taxCents)} />
          <View className="border-line flex-row justify-between border-t pt-2">
            <Text className="font-ui-semibold text-ink text-base">Total</Text>
            <Text className="font-ui-semibold text-ink text-base">{formatUsd(b.totalCents)}</Text>
          </View>
          {quote.promoRejected ? <Text className="text-caution font-body text-sm">That promo code can&apos;t be used on this order.</Text> : null}
          <View className="bg-paper rounded-xl px-3.5 py-3">
            <Text className="font-body text-ink text-sm">
              Estimated delivery:{' '}
              <Text className="font-ui-semibold">{formatDeliveryWindow(quote.delivery.est_delivery_from, quote.delivery.est_delivery_to)}</Text>
            </Text>
          </View>
        </>
      ) : (
        <>
          {/* D-112: the fixed charges from the first step; the server prices them again with the address. */}
          <ChargeRows />
          <Row label="Sales tax" value="after your details" />
        </>
      )}
    </View>
  );
}
