import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SHIPPING_RATES } from '@repo/shared/constants';

import { Header } from '../../../components/ui/header';
import { StatusTimeline } from '../../../components/ui/status-timeline';
import { fetchOrderDetails } from '../../../lib/queries/catalog';
import { useCartStore } from '../../../lib/store/cart';

import type { OrderWithFullDetails } from '@repo/shared/types';

export default function OrderTrackingScreen(): React.JSX.Element {
  const { id, email } = useLocalSearchParams<{ id: string; email?: string }>();
  const [order, setOrder] = useState<OrderWithFullDetails | null>(null);
  const [lookupStatus, setLookupStatus] = useState<'loading' | 'ready' | 'not_found'>(
    'loading',
  );

  const cartCount = useCartStore((state) => state.getItemCount());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchOrderDetails(id, typeof email === 'string' ? email : undefined).then((ord) => {
      if (cancelled) return;
      setOrder(ord);
      setLookupStatus(ord ? 'ready' : 'not_found');
    });
    return () => {
      cancelled = true;
    };
  }, [id, email]);

  if (lookupStatus === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Retrieving tracking status...</Text>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Order not found</Text>
        <Text style={styles.loadingSubtext}>
          Order details are protected. Open the link from your confirmation email, or contact
          support with your order number.
        </Text>
      </SafeAreaView>
    );
  }

  const shippingAddr =
    typeof order.shipping_address === 'object' && order.shipping_address !== null
      ? (order.shipping_address as Record<string, string>)
      : {};

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title={order.order_number} showBack bagCount={cartCount} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card Header */}
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.orderLabel}>ORDER TRACKING</Text>
              <Text style={styles.orderNumber}>{order.order_number}</Text>
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.carrierInfoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>CARRIER</Text>
              <Text style={styles.infoValue}>{order.carrier ?? 'Not yet assigned'}</Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>ESTIMATED DELIVERY</Text>
              <Text style={styles.infoValue}>
                {order.estimated_delivery_date ?? SHIPPING_RATES.standard.windowLabel}
              </Text>
            </View>
          </View>

          {order.tracking_code && (
            <View style={styles.trackingCodeBox}>
              <Text style={styles.trackingCodeLabel}>TRACKING NUMBER</Text>
              <Text style={styles.trackingCodeValue}>{order.tracking_code}</Text>
            </View>
          )}
        </View>

        {/* Order progress timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionHeader}>SHIPMENT PROGRESS</Text>
          <StatusTimeline
            status={order.status}
            orderDate={new Date(order.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            estimatedDelivery={order.estimated_delivery_date ?? undefined}
          />
        </View>

        {/* Ordered Items Preview */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionHeader}>PARCEL CONTENTS</Text>

          {order.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <View style={styles.itemBullet} />
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                <Text style={styles.itemVariant}>
                  {item.variant_label ?? 'Standard'} • Qty: {item.quantity}
                </Text>
              </View>
              <Text style={styles.itemPrice}>${(item.total_price_cents / 100).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Destination Address */}
        <View style={styles.addressCard}>
          <Text style={styles.sectionHeader}>DELIVERY DESTINATION</Text>
          <Text style={styles.addressName}>{shippingAddr.full_name ?? ''}</Text>
          <Text style={styles.addressLine}>
            {shippingAddr.line1 ?? ''}
            {shippingAddr.line2 ? `, ${shippingAddr.line2}` : ''}
          </Text>
          <Text style={styles.addressLine}>
            {shippingAddr.city ?? ''}
            {shippingAddr.city ? ', ' : ''}
            {shippingAddr.state ?? ''} {shippingAddr.zip_code ?? ''}
          </Text>
          <Text style={styles.addressLine}>United States</Text>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    color: '#71717A',
  },
  loadingSubtext: {
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
    fontSize: 13,
    color: '#A1A1AA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  orderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#71717A',
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.5,
  },
  carrierInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  trackingCodeBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  trackingCodeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 2,
  },
  trackingCodeValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#18181B',
    fontWeight: '600',
  },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 12,
  },
  itemsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F4F4F5',
  },
  itemBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#18181B',
    marginRight: 10,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  itemVariant: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
  },
  addressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  addressName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18181B',
    marginBottom: 2,
  },
  addressLine: {
    fontSize: 12,
    color: '#52525B',
    lineHeight: 18,
  },
});
