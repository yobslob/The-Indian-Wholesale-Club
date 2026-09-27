import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface CartItemRowProps {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  size: string;
  color: string;
  quantity: number;
  onUpdateQuantity: (id: string, newQuantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItemRow({
  id,
  title,
  price,
  imageUrl,
  size,
  color,
  quantity,
  onUpdateQuantity,
  onRemove,
}: CartItemRowProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      {/* Product Thumbnail */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      </View>

      {/* Item Details */}
      <View style={styles.details}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={() => onRemove(id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.removeButton}
          >
            <Ionicons name="trash-outline" size={16} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        {/* Variant Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Size: {size}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Color: {color}</Text>
          </View>
        </View>

        {/* Price & Quantity Controls */}
        <View style={styles.actionRow}>
          <Text style={styles.price}>${((price * quantity) / 100).toFixed(2)}</Text>

          <View style={styles.stepperContainer}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onUpdateQuantity(id, quantity - 1)}
              style={styles.stepperButton}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={quantity > 1 ? 'remove' : 'trash-outline'}
                size={14}
                color={quantity > 1 ? '#18181B' : '#EF4444'}
              />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{quantity}</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => onUpdateQuantity(id, quantity + 1)}
              style={styles.stepperButton}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="add" size={14} color="#18181B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  imageContainer: {
    width: 76,
    height: 98,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#F4F4F5',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  details: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#18181B',
    flex: 1,
    paddingRight: 8,
    lineHeight: 18,
  },
  removeButton: {
    padding: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  badge: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  stepperButton: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
    minWidth: 24,
    textAlign: 'center',
  },
});
