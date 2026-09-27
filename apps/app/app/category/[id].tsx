import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/ui/header';
import { ProductCard } from '../../components/ui/product-card';
import { fetchCategoryById, fetchProducts } from '../../lib/queries/catalog';
import { useCartStore } from '../../lib/store/cart';
import { useWishlistStore } from '../../lib/store/wishlist';

import type { Category, ProductWithDetails } from '@repo/shared/types';

export default function CategoryScreen(): React.JSX.Element {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [activeSort, setActiveSort] = useState<'featured' | 'price_low' | 'price_high'>('featured');

  const cartCount = useCartStore((state) => state.getItemCount());
  const { hasItem, toggleItem } = useWishlistStore();

  useEffect(() => {
    if (id) {
      fetchCategoryById(id).then((cat) => setCategory(cat));
      fetchProducts({
        categoryId: id,
        sortBy: activeSort,
      }).then((prods) => setProducts(prods));
    }
  }, [id, activeSort]);

  const handleProductPress = (prodId: string): void => {
    router.push({
      pathname: '/product/[id]',
      params: { id: prodId },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title={category?.name?.toUpperCase() ?? 'COLLECTION'} showBack bagCount={cartCount} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Header Banner */}
        <View style={styles.banner}>
          <Text style={styles.categoryTitle}>{category?.name ?? 'Collection'}</Text>
          <Text style={styles.categoryDesc}>
            {category?.description ?? 'Curated selection of elevated apparel'}
          </Text>
        </View>

        {/* Sort & Count Row */}
        <View style={styles.filterRow}>
          <Text style={styles.countText}>{products.length} Items</Text>

          <View style={styles.sortGroup}>
            <TouchableOpacity
              onPress={() => setActiveSort('featured')}
              style={[styles.sortPill, activeSort === 'featured' && styles.sortPillActive]}
            >
              <Text style={[styles.sortText, activeSort === 'featured' && styles.sortTextActive]}>
                Featured
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveSort('price_low')}
              style={[styles.sortPill, activeSort === 'price_low' && styles.sortPillActive]}
            >
              <Text style={[styles.sortText, activeSort === 'price_low' && styles.sortTextActive]}>
                $ Low
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveSort('price_high')}
              style={[styles.sortPill, activeSort === 'price_high' && styles.sortPillActive]}
            >
              <Text style={[styles.sortText, activeSort === 'price_high' && styles.sortTextActive]}>
                $ High
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Grid */}
        <View style={styles.grid}>
          {products.map((product) => {
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
                  categoryName={category?.name}
                  isWishlisted={hasItem(product.id)}
                  onPress={handleProductPress}
                  onWishlistToggle={toggleItem}
                />
              </View>
            );
          })}
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
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  banner: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#09090B',
    letterSpacing: -0.5,
  },
  categoryDesc: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
  },
  sortGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F4F4F5',
  },
  sortPillActive: {
    backgroundColor: '#18181B',
  },
  sortText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },
  sortTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  gridItem: {
    width: '50%',
  },
});
