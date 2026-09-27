import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_RATES } from '@repo/shared/constants';

import { ColorSelector } from '../../components/ui/color-selector';
import { Header } from '../../components/ui/header';
import { SizeSelector } from '../../components/ui/size-selector';
import { fetchProductById } from '../../lib/queries/catalog';
import { useCartStore } from '../../lib/store/cart';
import { useWishlistStore } from '../../lib/store/wishlist';

import type { ProductVariant, ProductWithDetails, SizeEnum } from '@repo/shared/types';

export default function ProductDetailScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [product, setProduct] = useState<ProductWithDetails | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [selectedSize, setSelectedSize] = useState<string>('M');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'details' | 'materials' | 'shipping'>('details');

  const cartCount = useCartStore((state) => state.getItemCount());
  const addItem = useCartStore((state) => state.addItem);
  const { hasItem, toggleItem } = useWishlistStore();

  useEffect(() => {
    if (id) {
      fetchProductById(id).then((p) => {
        if (p) {
          setProduct(p);
          const firstColor = p.variants[0]?.color_name ?? 'Default';
          setSelectedColor(firstColor);
        }
      });
    }
  }, [id]);

  if (!product) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading piece...</Text>
      </SafeAreaView>
    );
  }

  // Derive unique sizes and colors from variants
  const availableSizes: string[] = Array.from(
    new Set(product.variants.map((v) => v.size).filter((s): s is SizeEnum => s !== null)),
  );

  const availableColors = Array.from(
    new Set(product.variants.map((v) => v.color_name).filter((c): c is string => !!c)),
  ).map((name) => {
    const variant = product.variants.find((v) => v.color_name === name);
    return {
      name,
      hex: variant?.color_hex ?? '#18181B',
    };
  });

  const activeVariant: ProductVariant | undefined =
    product.variants.find(
      (v) =>
        (!v.size || v.size === selectedSize) && (!v.color_name || v.color_name === selectedColor),
    ) ?? product.variants[0];

  const inStock = (activeVariant?.inventory_count ?? 0) > 0;
  const isWishlisted = hasItem(product.id);

  const handleAddToBag = (): void => {
    const primaryImage =
      product.images[selectedImageIndex]?.url ??
      product.images[0]?.url ??
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800';

    addItem({
      productId: product.id,
      variantId: activeVariant?.id ?? product.id,
      productSlug: product.slug,
      title: product.name,
      price: activeVariant?.price_cents ?? product.base_price_cents,
      originalPrice: product.compare_at_price_cents,
      imageUrl: primaryImage,
      size: selectedSize,
      color: selectedColor || 'Standard',
      quantity: 1,
    });

    Alert.alert(
      'Added to Bag',
      `${product.name} (${selectedSize} / ${selectedColor}) has been added to your shopping bag.`,
      [
        { text: 'Keep Shopping', style: 'cancel' },
        { text: 'View Bag', onPress: () => router.push('/(tabs)/bag') },
      ],
    );
  };

  const currentImageUrl =
    product.images[selectedImageIndex]?.url ??
    product.images[0]?.url ??
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800';

  const discountPercent =
    product.compare_at_price_cents && product.compare_at_price_cents > product.base_price_cents
      ? Math.round(
          ((product.compare_at_price_cents - product.base_price_cents) /
            product.compare_at_price_cents) *
            100,
        )
      : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="ROOT" showBack bagCount={cartCount} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Image Showcase */}
        <View style={styles.imageGallery}>
          <Image source={{ uri: currentImageUrl }} style={styles.mainImage} resizeMode="cover" />

          {/* Wishlist Floating Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleItem(product.id)}
            style={styles.wishlistFloat}
          >
            <Ionicons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={20}
              color={isWishlisted ? '#EF4444' : '#18181B'}
            />
          </TouchableOpacity>

          {/* Multiple Image Dots */}
          {product.images.length > 1 && (
            <View style={styles.dotsRow}>
              {product.images.map((_, idx) => (
                <TouchableOpacity
                  key={`dot-${idx}`}
                  onPress={() => setSelectedImageIndex(idx)}
                  style={[styles.dot, selectedImageIndex === idx && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Product Details Section */}
        <View style={styles.infoSection}>
          {product.category && (
            <Text style={styles.categoryName}>{product.category.name.toUpperCase()}</Text>
          )}
          <Text style={styles.title}>{product.name}</Text>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>${(product.base_price_cents / 100).toFixed(2)}</Text>
            {product.compare_at_price_cents && (
              <Text style={styles.originalPrice}>
                ${(product.compare_at_price_cents / 100).toFixed(2)}
              </Text>
            )}
            {discountPercent && (
              <View style={styles.discountPill}>
                <Text style={styles.discountText}>SAVE {discountPercent}%</Text>
              </View>
            )}
          </View>

          {/* Stock Indicator */}
          <View style={styles.stockRow}>
            <View style={[styles.stockDot, { backgroundColor: inStock ? '#10B981' : '#EF4444' }]} />
            <Text style={styles.stockText}>
              {inStock
                ? (activeVariant?.inventory_count ?? 10) < 5
                  ? `Only ${activeVariant?.inventory_count} left in stock`
                  : 'In Stock • Ready for dispatch'
                : 'Sold Out'}
            </Text>
          </View>

          {/* Color Selector */}
          {availableColors.length > 0 && (
            <ColorSelector
              colors={availableColors}
              selectedColor={selectedColor}
              onSelect={setSelectedColor}
            />
          )}

          {/* Size Selector */}
          {availableSizes.length > 0 && (
            <SizeSelector
              sizes={availableSizes}
              selectedSize={selectedSize}
              onSelect={setSelectedSize}
            />
          )}

          {/* Tab Navigation for Product Specs */}
          <View style={styles.tabHeaderRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('details')}
              style={[styles.specTab, activeTab === 'details' && styles.specTabActive]}
            >
              <Text
                style={[styles.specTabText, activeTab === 'details' && styles.specTabTextActive]}
              >
                DESCRIPTION
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('materials')}
              style={[styles.specTab, activeTab === 'materials' && styles.specTabActive]}
            >
              <Text
                style={[styles.specTabText, activeTab === 'materials' && styles.specTabTextActive]}
              >
                FABRIC & FIT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('shipping')}
              style={[styles.specTab, activeTab === 'shipping' && styles.specTabActive]}
            >
              <Text
                style={[styles.specTabText, activeTab === 'shipping' && styles.specTabTextActive]}
              >
                SHIPPING
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.tabContent}>
            {activeTab === 'details' && (
              <Text style={styles.bodyText}>{product.long_description || product.description}</Text>
            )}

            {activeTab === 'materials' && (
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>• 100% premium long-staple natural fibers</Text>
                <Text style={styles.bulletItem}>
                  • Pre-washed and pre-shrunk for consistent fit
                </Text>
                <Text style={styles.bulletItem}>
                  • Tailored regular drape with reinforced seam construction
                </Text>
                <Text style={styles.bulletItem}>
                  • Machine wash cold with like colors, tumble dry low
                </Text>
              </View>
            )}

            {activeTab === 'shipping' && (
              <View style={styles.bulletList}>
                <Text style={styles.bulletItem}>
                  {`• Free standard US delivery on orders over $${FREE_SHIPPING_THRESHOLD_CENTS / 100}`}
                </Text>
                <Text style={styles.bulletItem}>
                  {`• Standard shipping: ${SHIPPING_RATES.standard.windowLabel}`}
                </Text>
                <Text style={styles.bulletItem}>
                  {`• Express priority: ${SHIPPING_RATES.express.windowLabel}`}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomBarPrice}>
          <Text style={styles.bottomBarLabel}>PRICE</Text>
          <Text style={styles.bottomBarAmount}>${(product.base_price_cents / 100).toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.88}
          onPress={handleAddToBag}
          disabled={!inStock}
          style={[styles.addBagButton, !inStock && styles.addBagButtonDisabled]}
        >
          <Ionicons name="bag" size={16} color="#FFFFFF" />
          <Text style={styles.addBagText}>{inStock ? 'ADD TO BAG' : 'OUT OF STOCK'}</Text>
        </TouchableOpacity>
      </View>
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  imageGallery: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: '#F4F4F5',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  wishlistFloat: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotActive: {
    backgroundColor: '#18181B',
    width: 16,
  },
  infoSection: {
    padding: 20,
  },
  categoryName: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#71717A',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#09090B',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#09090B',
  },
  originalPrice: {
    fontSize: 15,
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
  },
  discountPill: {
    backgroundColor: '#18181B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stockText: {
    fontSize: 12,
    color: '#52525B',
    fontWeight: '500',
  },
  tabHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    marginTop: 20,
    marginBottom: 12,
  },
  specTab: {
    paddingVertical: 10,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  specTabActive: {
    borderBottomColor: '#18181B',
  },
  specTabText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: '#A1A1AA',
  },
  specTabTextActive: {
    color: '#18181B',
    fontWeight: '700',
  },
  tabContent: {
    paddingVertical: 6,
  },
  bodyText: {
    fontSize: 13,
    color: '#52525B',
    lineHeight: 20,
  },
  bulletList: {
    gap: 8,
  },
  bulletItem: {
    fontSize: 13,
    color: '#52525B',
    lineHeight: 18,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  bottomBarPrice: {
    justifyContent: 'center',
  },
  bottomBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
  },
  bottomBarAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090B',
  },
  addBagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181B',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addBagButtonDisabled: {
    backgroundColor: '#A1A1AA',
  },
  addBagText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
