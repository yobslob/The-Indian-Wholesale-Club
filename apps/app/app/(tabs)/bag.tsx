import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_RATES } from '@repo/shared/constants';

import { CartItemRow } from '../../components/ui/cart-item-row';
import { Header } from '../../components/ui/header';
import { useCartStore } from '../../lib/store/cart';

export default function BagScreen(): React.JSX.Element {
  const router = useRouter();
  const [promoInput, setPromoInput] = useState<string>('');

  const {
    items,
    promoCode,
    promoDiscountType,
    promoDiscountValue,
    shippingMethod,
    updateQuantity,
    removeItem,
    applyPromoCode,
    removePromoCode,
    setShippingMethod,
    getSubtotalCents,
    getDiscountCents,
    getShippingCents,
    getTotalCents,
  } = useCartStore();

  const subtotal = getSubtotalCents();
  const discount = getDiscountCents();
  const shipping = getShippingCents();
  const total = getTotalCents();

  const freeShippingThreshold = FREE_SHIPPING_THRESHOLD_CENTS;
  const progressRatio = Math.min(1, subtotal / freeShippingThreshold);
  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);

  const handleApplyPromo = async (): Promise<void> => {
    if (!promoInput.trim()) return;
    const res = await applyPromoCode(promoInput);
    if (res.success) {
      setPromoInput('');
      Alert.alert('Promo Code', res.message);
    } else {
      Alert.alert('Promo Code', res.message);
    }
  };

  const handleProceedCheckout = (): void => {
    router.push('/bag/checkout');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="SHOPPING BAG" showBack={false} showSearch={false} showBag={false} />

      {items.length > 0 ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Free Shipping Progress Meter */}
            <View style={styles.meterCard}>
              <View style={styles.meterHeader}>
                <Ionicons
                  name={progressRatio >= 1 ? 'checkmark-circle' : 'cube-outline'}
                  size={16}
                  color={progressRatio >= 1 ? '#059669' : '#18181B'}
                />
                <Text style={styles.meterText}>
                  {progressRatio >= 1
                    ? 'You have qualified for FREE standard delivery!'
                    : `Add $${(remainingForFreeShipping / 100).toFixed(2)} more for FREE delivery`}
                </Text>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.round(progressRatio * 100)}%`,
                      backgroundColor: progressRatio >= 1 ? '#10B981' : '#18181B',
                    },
                  ]}
                />
              </View>
            </View>

            {/* Cart Items List */}
            <View style={styles.itemsList}>
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  id={item.id}
                  title={item.title}
                  price={item.price}
                  imageUrl={item.imageUrl}
                  size={item.size}
                  color={item.color}
                  quantity={item.quantity}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </View>

            {/* Shipping Tier Selection */}
            <View style={styles.shippingSection}>
              <Text style={styles.sectionHeader}>DELIVERY METHOD</Text>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShippingMethod('standard')}
                style={[
                  styles.shippingOption,
                  shippingMethod === 'standard' && styles.shippingOptionActive,
                ]}
              >
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Standard Shipping</Text>
                  <Text style={styles.optionSubtitle}>
                    {`${SHIPPING_RATES.standard.windowLabel} (Direct Regional Transit)`}
                  </Text>
                </View>
                <Text style={styles.optionPrice}>
                  {subtotal >= FREE_SHIPPING_THRESHOLD_CENTS
                    ? 'FREE'
                    : `$${SHIPPING_RATES.standard.price}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShippingMethod('express')}
                style={[
                  styles.shippingOption,
                  shippingMethod === 'express' && styles.shippingOptionActive,
                ]}
              >
                <View style={styles.optionInfo}>
                  <Text style={styles.optionTitle}>Express Priority</Text>
                  <Text style={styles.optionSubtitle}>
                    {`${SHIPPING_RATES.express.windowLabel} (Air Hub Priority)`}
                  </Text>
                </View>
                <Text style={styles.optionPrice}>{`$${SHIPPING_RATES.express.price}`}</Text>
              </TouchableOpacity>
            </View>

            {/* Promo Code Section */}
            <View style={styles.promoSection}>
              <Text style={styles.sectionHeader}>DISCOUNT CODE</Text>

              {promoCode ? (
                <View style={styles.appliedPromoBadge}>
                  <View style={styles.promoBadgeLeft}>
                    <Ionicons name="pricetag" size={16} color="#047857" />
                    <Text style={styles.promoAppliedText}>
                      {promoCode}
                      {promoDiscountType === 'percentage'
                        ? ` (${promoDiscountValue}% OFF)`
                        : ' (APPLIED)'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={removePromoCode}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#71717A" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.promoRow}>
                  <TextInput
                    value={promoInput}
                    onChangeText={setPromoInput}
                    placeholder="Enter code (e.g. WELCOME10)"
                    placeholderTextColor="#A1A1AA"
                    autoCapitalize="characters"
                    style={styles.promoInput}
                  />
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => void handleApplyPromo()}
                    style={styles.applyBtn}
                  >
                    <Text style={styles.applyBtnText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Cost Breakdown */}
            <View style={styles.summaryCard}>
              <Text style={styles.sectionHeader}>ORDER SUMMARY</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>${(subtotal / 100).toFixed(2)}</Text>
              </View>

              {discount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.discountLabel}>
                    Discount
                    {promoDiscountType === 'percentage' ? ` (${promoDiscountValue}%)` : ''}
                  </Text>
                  <Text style={styles.discountValue}>-${(discount / 100).toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Shipping</Text>
                <Text style={styles.summaryValue}>
                  {shipping === 0 ? 'FREE' : `$${(shipping / 100).toFixed(2)}`}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated Sales Tax</Text>
                <Text style={styles.summaryValue}>
                  ${((total - (subtotal - discount + shipping)) / 100).toFixed(2)}
                </Text>
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total (USD)</Text>
                <Text style={styles.totalValue}>${(total / 100).toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Checkout CTA Bar */}
          <View style={styles.checkoutBar}>
            <View style={styles.checkoutBarInfo}>
              <Text style={styles.barTotalLabel}>TOTAL</Text>
              <Text style={styles.barTotalValue}>${(total / 100).toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleProceedCheckout}
              style={styles.checkoutButton}
            >
              <Text style={styles.checkoutButtonText}>PROCEED TO CHECKOUT</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* Empty Bag View */
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="bag-handle-outline" size={44} color="#71717A" />
          </View>
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptySubtitle}>
            Explore our curated wardrobe capsule of elevated minimalist essentials.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)')}
            style={styles.exploreButton}
          >
            <Text style={styles.exploreButtonText}>EXPLORE CAPSULE</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  meterCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  meterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E4E4E7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  itemsList: {
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  shippingSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 10,
  },
  shippingOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    marginBottom: 8,
  },
  shippingOptionActive: {
    borderColor: '#18181B',
    backgroundColor: '#FAFAFA',
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    marginLeft: 8,
  },
  promoSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#18181B',
  },
  applyBtn: {
    backgroundColor: '#18181B',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  appliedPromoBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  promoBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoAppliedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#047857',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#71717A',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#18181B',
  },
  discountLabel: {
    fontSize: 13,
    color: '#047857',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#09090B',
  },
  checkoutBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  checkoutBarInfo: {
    justifyContent: 'center',
  },
  barTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  barTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090B',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181B',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#FAFAFA',
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: '#18181B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 6,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
