import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/ui/header';
import { ProductCard } from '../../components/ui/product-card';
import { fetchProducts } from '../../lib/queries/catalog';
import { useCartStore } from '../../lib/store/cart';
import { useWishlistStore } from '../../lib/store/wishlist';

import type { ProductWithDetails } from '@repo/shared/types';

const TRENDING_TAGS = [
  'Heavyweight Tee',
  'Oxford Shirt',
  'Slim Chino',
  'Linen Dress',
  'Ribbed Tank',
  'Canvas Tote',
];

export default function SearchScreen(): React.JSX.Element {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [activeSort, setActiveSort] = useState<'featured' | 'price_low' | 'price_high'>('featured');

  const cartCount = useCartStore((state) => state.getItemCount());
  const { hasItem, toggleItem } = useWishlistStore();

  const runSearch = async (
    query: string,
    sort: 'featured' | 'price_low' | 'price_high',
  ): Promise<void> => {
    const results = await fetchProducts({
      search: query,
      sortBy: sort,
    });
    setProducts(results);
  };

  useEffect(() => {
    runSearch(searchQuery, activeSort);
  }, [searchQuery, activeSort]);

  const handleProductPress = (id: string): void => {
    router.push({
      pathname: '/product/[id]',
      params: { id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="SEARCH" bagCount={cartCount} showSearch={false} />

      {/* Search Input Bar */}
      <View style={styles.inputContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#71717A" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search clothing, fabrics, essentials..."
            placeholderTextColor="#A1A1AA"
            style={styles.textInput}
            clearButtonMode="while-editing"
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#71717A" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trending Searches Pills */}
        <View style={styles.trendingSection}>
          <Text style={styles.sectionTitle}>POPULAR SEARCHES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagsScroll}
          >
            {TRENDING_TAGS.map((tag) => {
              const isSelected = searchQuery.toLowerCase() === tag.toLowerCase();
              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.7}
                  onPress={() => setSearchQuery(isSelected ? '' : tag)}
                  style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                >
                  <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Sort Controls */}
        <View style={styles.filterRow}>
          <Text style={styles.resultCount}>
            {products.length} {products.length === 1 ? 'RESULT' : 'RESULTS'}
          </Text>

          <View style={styles.sortButtonGroup}>
            <TouchableOpacity
              onPress={() => setActiveSort('featured')}
              style={[styles.sortButton, activeSort === 'featured' && styles.sortButtonActive]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  activeSort === 'featured' && styles.sortButtonTextActive,
                ]}
              >
                Featured
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveSort('price_low')}
              style={[styles.sortButton, activeSort === 'price_low' && styles.sortButtonActive]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  activeSort === 'price_low' && styles.sortButtonTextActive,
                ]}
              >
                $ Low
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveSort('price_high')}
              style={[styles.sortButton, activeSort === 'price_high' && styles.sortButtonActive]}
            >
              <Text
                style={[
                  styles.sortButtonText,
                  activeSort === 'price_high' && styles.sortButtonTextActive,
                ]}
              >
                $ High
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Product Results Grid or Empty State */}
        {products.length > 0 ? (
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
                    categoryName={product.category?.name}
                    isWishlisted={hasItem(product.id)}
                    onPress={handleProductPress}
                    onWishlistToggle={toggleItem}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#D4D4D8" />
            <Text style={styles.emptyTitle}>No matching products</Text>
            <Text style={styles.emptySubtitle}>
              Try searching for &quot;Tee&quot;, &quot;Oxford&quot;, or &quot;Chino&quot;
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
            >
              <Text style={styles.clearSearchBtnText}>RESET SEARCH</Text>
            </TouchableOpacity>
          </View>
        )}
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
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  textInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#18181B',
  },
  trendingSection: {
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#71717A',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tagsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  tagPillSelected: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#3F3F46',
  },
  tagTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
    marginBottom: 8,
  },
  resultCount: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
  },
  sortButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#F4F4F5',
  },
  sortButtonActive: {
    backgroundColor: '#18181B',
  },
  sortButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#71717A',
  },
  sortButtonTextActive: {
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18181B',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 20,
  },
  clearSearchBtn: {
    backgroundColor: '#18181B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 6,
  },
  clearSearchBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
