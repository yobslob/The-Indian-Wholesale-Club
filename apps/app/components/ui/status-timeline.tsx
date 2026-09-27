import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface TimelineMilestone {
  key: string;
  title: string;
  description: string;
  location?: string;
  timestamp?: string;
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface StatusTimelineProps {
  status: string;
  orderDate?: string;
  estimatedDelivery?: string;
}

export function StatusTimeline({
  status,
  orderDate,
  estimatedDelivery,
}: StatusTimelineProps): React.JSX.Element {
  // Normalize status key to determine progression index
  const normalizedStatus = status.toLowerCase();

  let activeIndex = 0;
  if (['confirmed', 'pending_payment'].includes(normalizedStatus)) {
    activeIndex = 0;
  } else if (['processing', 'customs_hold'].includes(normalizedStatus)) {
    activeIndex = 1;
  } else if (['shipped', 'in_transit'].includes(normalizedStatus)) {
    activeIndex = 2;
  } else if (normalizedStatus === 'out_for_delivery') {
    activeIndex = 3;
  } else if (normalizedStatus === 'delivered') {
    activeIndex = 4;
  }

  const milestones: TimelineMilestone[] = [
    {
      key: 'confirmed',
      title: 'Order Confirmed',
      description: 'Your order has been verified and sent for fulfillment.',
      location: 'US Operations Center',
      timestamp: orderDate ?? 'Completed',
      isCompleted: activeIndex >= 0,
      isCurrent: activeIndex === 0,
    },
    {
      key: 'processing',
      title: 'Regional Fulfillment Hub',
      description: 'Garments undergoing precision quality inspection and packing.',
      location: 'Carrier Regional Hub',
      timestamp: activeIndex >= 1 ? 'Processed' : undefined,
      isCompleted: activeIndex >= 1,
      isCurrent: activeIndex === 1,
    },
    {
      key: 'in_transit',
      title: 'Shipment In Transit',
      description: 'Package en route via carrier logistics network.',
      location: 'Domestic Transit Line',
      timestamp: activeIndex >= 2 ? 'In Transit' : undefined,
      isCompleted: activeIndex >= 2,
      isCurrent: activeIndex === 2,
    },
    {
      key: 'out_for_delivery',
      title: 'Out for Delivery',
      description: 'Package with local partner courier for doorstep delivery.',
      location: 'Local Delivery Facility',
      timestamp: activeIndex >= 3 ? 'Today' : undefined,
      isCompleted: activeIndex >= 3,
      isCurrent: activeIndex === 3,
    },
    {
      key: 'delivered',
      title: 'Delivered',
      description: 'Package safely delivered to your destination address.',
      location: 'Destination Address',
      timestamp:
        activeIndex === 4
          ? 'Delivered'
          : estimatedDelivery
            ? `Est: ${estimatedDelivery}`
            : 'Pending',
      isCompleted: activeIndex === 4,
      isCurrent: activeIndex === 4,
    },
  ];

  return (
    <View style={styles.container}>
      {milestones.map((step, index) => {
        const isLast = index === milestones.length - 1;

        return (
          <View key={step.key} style={styles.row}>
            {/* Timeline Indicator Column */}
            <View style={styles.indicatorCol}>
              <View
                style={[
                  styles.circle,
                  step.isCompleted && styles.circleCompleted,
                  step.isCurrent && styles.circleCurrent,
                ]}
              >
                {step.isCompleted && !step.isCurrent && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
                {step.isCurrent && <View style={styles.currentDot} />}
              </View>

              {!isLast && (
                <View
                  style={[
                    styles.connector,
                    step.isCompleted && index < activeIndex
                      ? styles.connectorActive
                      : styles.connectorInactive,
                  ]}
                />
              )}
            </View>

            {/* Timeline Content */}
            <View style={styles.contentCol}>
              <View style={styles.stepHeader}>
                <Text
                  style={[
                    styles.stepTitle,
                    step.isCompleted && styles.stepTitleCompleted,
                    step.isCurrent && styles.stepTitleCurrent,
                  ]}
                >
                  {step.title}
                </Text>
                {step.timestamp && <Text style={styles.timestamp}>{step.timestamp}</Text>}
              </View>

              <Text style={styles.description}>{step.description}</Text>

              {step.location && (
                <View style={styles.locationBadge}>
                  <Ionicons name="location-outline" size={12} color="#71717A" />
                  <Text style={styles.locationText}>{step.location}</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    minHeight: 74,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 32,
    marginRight: 12,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D4D4D8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  circleCompleted: {
    borderColor: '#18181B',
    backgroundColor: '#18181B',
  },
  circleCurrent: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  currentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -2,
    zIndex: 1,
  },
  connectorActive: {
    backgroundColor: '#18181B',
  },
  connectorInactive: {
    backgroundColor: '#E4E4E7',
  },
  contentCol: {
    flex: 1,
    paddingBottom: 20,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#71717A',
  },
  stepTitleCompleted: {
    color: '#18181B',
    fontWeight: '600',
  },
  stepTitleCurrent: {
    color: '#047857',
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },
  description: {
    fontSize: 12,
    color: '#52525B',
    lineHeight: 17,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
  },
});
