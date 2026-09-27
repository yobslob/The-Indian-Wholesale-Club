import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  originalPrice?: number | null;
  imageUrl: string;
  isWishlisted: boolean;
  categoryName?: string | null;
  onPress: (id: string) => void;
  onWishlistToggle: (id: string) => void;
}

export function ProductCard({
  id,
  title,
  price,
  originalPrice,
  imageUrl,
  isWishlisted,
  categoryName,
  onPress,
  onWishlistToggle,
}: ProductCardProps): React.JSX.Element {
  const discountPercent =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  return (
    <TouchableOpacity activeOpacity={0.88} onPress={() => onPress(id)} style={styles.card}>
      {/* 3:4 Aspect Ratio Image Container */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />

        {/* Discount Badge */}
        {discountPercent !== null && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>-{discountPercent}%</Text>
          </View>
        )}

        {/* Wishlist Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onWishlistToggle(id)}
          style={styles.wishlistButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isWishlisted ? 'heart' : 'heart-outline'}
            size={18}
            color={isWishlisted ? '#EF4444' : '#18181B'}
          />
        </TouchableOpacity>
      </View>

      {/* Product Metadata */}
      <View style={styles.content}>
        {categoryName && (
          <Text style={styles.category} numberOfLines={1}>
            {categoryName.toUpperCase()}
          </Text>
        )}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.priceRow}>
          <Text style={styles.price}>${(price / 100).toFixed(2)}</Text>
          {originalPrice && originalPrice > price && (
            <Text style={styles.originalPrice}>${(originalPrice / 100).toFixed(2)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F4F4F5',
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#18181B',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  wishlistButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  category: {
    fontSize: 9,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#09090B',
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: '400',
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
  },
});
