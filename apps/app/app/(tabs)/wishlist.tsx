import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/ui/header';
import { ProductCard } from '../../components/ui/product-card';
import { fetchProducts } from '../../lib/queries/catalog';
import { useCartStore } from '../../lib/store/cart';
import { useWishlistStore } from '../../lib/store/wishlist';

import type { ProductWithDetails } from '@repo/shared/types';

export default function WishlistScreen(): React.JSX.Element {
  const router = useRouter();
  const [allProducts, setAllProducts] = useState<ProductWithDetails[]>([]);

  const cartCount = useCartStore((state) => state.getItemCount());
  const { productIds, hasItem, toggleItem } = useWishlistStore();

  useEffect(() => {
    fetchProducts().then((res) => setAllProducts(res));
  }, []);

  const savedProducts = allProducts.filter((p) => productIds.includes(p.id));

  const handleProductPress = (id: string): void => {
    router.push({
      pathname: '/product/[id]',
      params: { id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="WISHLIST" bagCount={cartCount} />

      {savedProducts.length > 0 ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.subHeader}>
            <Text style={styles.subHeaderTitle}>SAVED ESSENTIALS</Text>
            <Text style={styles.subHeaderCount}>
              {savedProducts.length} {savedProducts.length === 1 ? 'PIECE' : 'PIECES'}
            </Text>
          </View>

          <View style={styles.grid}>
            {savedProducts.map((product) => {
              const primaryImage =
                product.images.find((img) => img.is_primary)?.url ??
                product.images[0]?.url ??
                'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800';

              return (
                <View key={product.id} style={styles.gridItem}>
                  <ProductCard
                    id={product.id}
                    title={product.name}
                    price={product.base_price_cents}
                    originalPrice={product.compare_at_price_cents}
                    imageUrl={primaryImage}
                    categoryName={product.category?.name}
                    isWishlisted={hasItem(product.id)}
                    onPress={handleProductPress}
                    onWishlistToggle={toggleItem}
                  />
                </View>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="heart-outline" size={44} color="#71717A" />
          </View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>
            Save pieces you love to build and curate your personalized seasonal wardrobe.
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)')}
            style={styles.exploreButton}
          >
            <Text style={styles.exploreButtonText}>EXPLORE PIECES</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  subHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#18181B',
  },
  subHeaderCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    marginTop: 8,
  },
  gridItem: {
    width: '50%',
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
