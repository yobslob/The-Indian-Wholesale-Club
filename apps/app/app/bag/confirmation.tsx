import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHIPPING_RATES } from '@repo/shared/constants';

export default function ConfirmationScreen(): React.JSX.Element {
  const router = useRouter();
  const { orderId = '', total = '', email = '' } = useLocalSearchParams<{
    orderId: string;
    total: string;
    email: string;
    itemCount: string;
  }>();

  const handleTrack = (): void => {
    router.replace({
      pathname: '/profile/orders/[id]',
      params: { id: orderId, email },
    });
  };

  const handleContinue = (): void => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={38} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>ORDER CONFIRMED</Text>
        <Text style={styles.orderNumber}>ORDER #{orderId}</Text>

        <Text style={styles.subtitle}>
          A confirmation receipt and fulfillment dispatch schedule have been sent to{' '}
          <Text style={styles.emailHighlight}>{email}</Text>.
        </Text>

        {/* Order Details Card */}
        <View style={styles.receiptCard}>
          <View style={styles.row}>
            <Text style={styles.label}>AMOUNT CHARGED</Text>
            <Text style={styles.value}>${total} USD</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>FULFILLMENT</Text>
            <Text style={styles.value}>US Domestic Partner Network</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>DELIVERY ESTIMATE</Text>
            <Text style={styles.value}>{SHIPPING_RATES.standard.windowLabel}</Text>
          </View>

          <View style={styles.rowLast}>
            <Text style={styles.label}>ROUTING ORIGIN</Text>
            <Text style={styles.value}>Carrier Regional Hub</Text>
          </View>
        </View>

        {/* Stealth Guarantee Card */}
        <View style={styles.stealthCard}>
          <Ionicons name="shield-checkmark" size={20} color="#059669" />
          <View style={styles.stealthTextContainer}>
            <Text style={styles.stealthTitle}>Stealth Delivery Assurance</Text>
            <Text style={styles.stealthDesc}>
              Your parcel undergoes rigorous inspection at our regional fulfillment center and is
              handed over to USPS for doorstep delivery.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.88} onPress={handleTrack} style={styles.trackBtn}>
            <Ionicons name="cube-outline" size={16} color="#FFFFFF" />
            <Text style={styles.trackBtnText}>TRACK YOUR SHIPMENT</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleContinue} style={styles.continueBtn}>
            <Text style={styles.continueBtnText}>CONTINUE SHOPPING</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#09090B',
    letterSpacing: 1,
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 13,
    color: '#52525B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  emailHighlight: {
    color: '#18181B',
    fontWeight: '600',
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FAFAFA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  rowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  stealthCard: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  stealthTextContainer: {
    flex: 1,
  },
  stealthTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 2,
  },
  stealthDesc: {
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    paddingVertical: 14,
    borderRadius: 8,
  },
  trackBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  continueBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    paddingVertical: 14,
    borderRadius: 8,
  },
  continueBtnText: {
    color: '#18181B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
