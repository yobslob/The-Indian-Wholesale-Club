import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
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

import { Header } from '../../components/ui/header';
import { apiPost } from '../../lib/api';
import { useCartStore } from '../../lib/store/cart';

export default function CheckoutScreen(): React.JSX.Element {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const {
    items,
    promoCode,
    shippingMethod,
    setShippingMethod,
    getSubtotalCents,
    getDiscountCents,
    getShippingCents,
    getTotalCents,
    clearCart,
  } = useCartStore();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [street, setStreet] = useState<string>('');
  const [apartment, setApartment] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zip, setZip] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const subtotal = getSubtotalCents();
  const discount = getDiscountCents();
  const shipping = getShippingCents();
  const total = getTotalCents();

  const handlePlaceOrder = async (): Promise<void> => {
    if (!fullName || !email || !street || !city || !state || !zip) {
      Alert.alert('Incomplete Address', 'Please provide a full US shipping destination.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Empty Bag', 'Add at least one item before placing an order.');
      return;
    }

    if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      Alert.alert(
        'Payment Unavailable',
        'Secure card payments are not configured on this build. Please try again later.',
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const intent = await apiPost<{
        clientSecret: string;
        paymentIntentId: string;
        error?: string;
      }>('/api/checkout/create-intent', {
        items: items.map((item) => ({
          variantId: item.variantId,
          productId: item.productId,
          productName: item.title,
          productSlug: item.productSlug,
          priceCents: item.price,
          quantity: item.quantity,
          size: item.size || null,
          colorName: item.color || null,
          imageUrl: item.imageUrl || null,
        })),
        shippingAddress: {
          email,
          fullName,
          line1: street,
          ...(apartment ? { line2: apartment } : {}),
          city,
          state,
          zipCode: zip,
          country: 'US',
        },
        shippingMethod,
        promoCode: promoCode ?? undefined,
      });

      if (!intent.ok || !intent.data?.clientSecret || !intent.data.paymentIntentId) {
        Alert.alert(
          'Payment Unavailable',
          intent.data?.error ?? intent.error ?? 'Could not initialize secure payment.',
        );
        return;
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ROOT',
        paymentIntentClientSecret: intent.data.clientSecret,
        defaultBillingDetails: { name: fullName, email },
      });
      if (initError) {
        Alert.alert('Payment Unavailable', initError.message);
        return;
      }

      const { error: paymentError } = await presentPaymentSheet();
      if (paymentError) {
        if (paymentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', paymentError.message);
        }
        return;
      }

      // The server verifies the Stripe intent status, amount, currency, and ownership.
      const res = await apiPost<{
        success: boolean;
        orderId: string;
        orderNumber: string;
        totalCents: number;
        error?: string;
      }>('/api/orders/create', {
        items: items.map((item) => ({
          variantId: item.variantId,
          productId: item.productId,
          productName: item.title,
          productSlug: item.productSlug,
          priceCents: item.price,
          quantity: item.quantity,
          size: item.size || null,
          colorName: item.color || null,
          imageUrl: item.imageUrl || null,
        })),
        shippingAddress: {
          email,
          fullName,
          line1: street,
          ...(apartment ? { line2: apartment } : {}),
          city,
          state,
          zipCode: zip,
          country: 'US',
        },
        shippingMethod,
        promoCode: promoCode ?? undefined,
        paymentIntentId: intent.data.paymentIntentId,
        paymentProvider: 'stripe',
      });

      if (!res.ok || !res.data?.success) {
        Alert.alert(
          'Order Failed',
          res.data?.error ?? res.error ?? 'Could not place your order. Please try again.',
        );
        return;
      }

      const itemCount = items.length;
      clearCart();
      router.replace({
        pathname: '/bag/confirmation',
        params: {
          orderId: res.data.orderNumber,
          total: (res.data.totalCents / 100).toFixed(2),
          email,
          itemCount: itemCount.toString(),
        },
      });
    } catch (err) {
      Alert.alert('Order Failed', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="CHECKOUT" showBack showSearch={false} showBag={false} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Step 1: Domestic Shipping Address */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={styles.sectionTitle}>US SHIPPING ADDRESS</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="First and last name"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>EMAIL ADDRESS (FOR RECEIPT)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>STREET ADDRESS</Text>
              <TextInput
                value={street}
                onChangeText={setStreet}
                placeholder="Street address or P.O. Box"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>APT / SUITE / UNIT (OPTIONAL)</Text>
              <TextInput
                value={apartment}
                onChangeText={setApartment}
                placeholder="Apartment, suite, unit, etc."
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 2, marginRight: 8 }]}>
                <Text style={styles.label}>CITY</Text>
                <TextInput
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                  style={styles.input}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>STATE</Text>
                <TextInput
                  value={state}
                  onChangeText={setState}
                  placeholder="OR"
                  autoCapitalize="characters"
                  maxLength={2}
                  style={styles.input}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1.5 }]}>
                <Text style={styles.label}>ZIP CODE</Text>
                <TextInput
                  value={zip}
                  onChangeText={setZip}
                  placeholder="97477"
                  keyboardType="numeric"
                  maxLength={5}
                  style={styles.input}
                />
              </View>
            </View>
          </View>

          {/* Step 2: Shipping Tier */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={styles.sectionTitle}>DELIVERY SPEED</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShippingMethod('standard')}
              style={[
                styles.methodOption,
                shippingMethod === 'standard' && styles.methodOptionActive,
              ]}
            >
              <View style={styles.radio}>
                {shippingMethod === 'standard' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.methodDetails}>
                <Text style={styles.methodName}>Standard Shipping</Text>
                <Text style={styles.methodSubtext}>{SHIPPING_RATES.standard.windowLabel}</Text>
              </View>
              <Text style={styles.methodPrice}>
                {subtotal >= FREE_SHIPPING_THRESHOLD_CENTS
                  ? 'FREE'
                  : `$${SHIPPING_RATES.standard.price}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShippingMethod('express')}
              style={[
                styles.methodOption,
                shippingMethod === 'express' && styles.methodOptionActive,
              ]}
            >
              <View style={styles.radio}>
                {shippingMethod === 'express' && <View style={styles.radioInner} />}
              </View>
              <View style={styles.methodDetails}>
                <Text style={styles.methodName}>Express Air Priority</Text>
                <Text style={styles.methodSubtext}>
                  {`${SHIPPING_RATES.express.windowLabel} priority line`}
                </Text>
              </View>
              <Text style={styles.methodPrice}>{`$${SHIPPING_RATES.express.price}`}</Text>
            </TouchableOpacity>
          </View>

          {/* Step 3: Payment Method */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>3</Text>
              </View>
              <Text style={styles.sectionTitle}>PAYMENT METHOD</Text>
            </View>

            <Text style={styles.paymentDescription}>
              Card details are collected securely by Stripe in the payment sheet.
            </Text>
          </View>

          {/* Order Review Breakdown */}
          <View style={styles.card}>
            <Text style={styles.reviewTitle}>FINAL BREAKDOWN</Text>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Subtotal</Text>
              <Text style={styles.breakdownValue}>${(subtotal / 100).toFixed(2)}</Text>
            </View>

            {discount > 0 && (
              <View style={styles.breakdownRow}>
                <Text style={styles.discountLabel}>Promo Discount</Text>
                <Text style={styles.discountValue}>-${(discount / 100).toFixed(2)}</Text>
              </View>
            )}

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Shipping</Text>
              <Text style={styles.breakdownValue}>
                {shipping === 0 ? 'FREE' : `$${(shipping / 100).toFixed(2)}`}
              </Text>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Estimated US Tax</Text>
              <Text style={styles.breakdownValue}>
                ${((total - (subtotal - discount + shipping)) / 100).toFixed(2)}
              </Text>
            </View>

            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotalLabel}>TOTAL DUE</Text>
              <Text style={styles.breakdownTotalValue}>${(total / 100).toFixed(2)}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Place Order Sticky Bottom Action */}
        <View style={styles.actionFooter}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={handlePlaceOrder}
            disabled={isSubmitting}
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={16} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>
                  PAY ${(total / 100).toFixed(2)} & PLACE ORDER
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  stepCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#18181B',
  },
  formGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#71717A',
    marginBottom: 4,
  },
  input: {
    height: 42,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#18181B',
    backgroundColor: '#FAFAFA',
  },
  row: {
    flexDirection: 'row',
  },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    marginBottom: 8,
  },
  methodOptionActive: {
    borderColor: '#18181B',
    backgroundColor: '#F4F4F5',
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#18181B',
  },
  methodDetails: {
    flex: 1,
  },
  methodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  methodSubtext: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  methodPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    marginLeft: 8,
  },
  paymentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  paymentToggleActive: {
    borderColor: '#18181B',
    backgroundColor: '#F4F4F5',
  },
  paymentToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  paymentDescription: {
    fontSize: 12,
    color: '#71717A',
    lineHeight: 18,
    marginTop: 8,
  },
  cardForm: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  reviewTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#71717A',
  },
  breakdownValue: {
    fontSize: 12,
    color: '#18181B',
    fontWeight: '500',
  },
  discountLabel: {
    fontSize: 12,
    color: '#047857',
  },
  discountValue: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  breakdownTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#09090B',
  },
  breakdownTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#09090B',
  },
  actionFooter: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    paddingVertical: 15,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#71717A',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
