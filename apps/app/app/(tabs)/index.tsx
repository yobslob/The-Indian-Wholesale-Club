import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '../../components/ui/header';
import { ProductCard } from '../../components/ui/product-card';
import { fetchCategories, fetchProducts } from '../../lib/queries/catalog';
import { useCartStore } from '../../lib/store/cart';
import { useWishlistStore } from '../../lib/store/wishlist';

import type { Category, ProductWithDetails } from '@repo/shared/types';

export default function ShopScreen(): React.JSX.Element {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('cat-all');
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const cartCount = useCartStore((state) => state.getItemCount());
  const { hasItem, toggleItem } = useWishlistStore();

  const loadData = async (catId: string): Promise<void> => {
    const cats = await fetchCategories();
    setCategories(cats);

    const prods = await fetchProducts({
      categoryId: catId === 'cat-all' ? undefined : catId,
    });
    setProducts(prods);
  };

  useEffect(() => {
    loadData(selectedCategory);
  }, [selectedCategory]);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await loadData(selectedCategory);
    setRefreshing(false);
  };

  const handleProductPress = (id: string): void => {
    router.push({
      pathname: '/product/[id]',
      params: { id },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header title="ROOT" bagCount={cartCount} />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#18181B" />
        }
      >
        {/* Editorial Hero Banner */}
        <View style={styles.heroWrapper}>
          <ImageBackground
            source={{
              uri: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
            }}
            style={styles.heroBackground}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroOverlay}>
              <Text style={styles.heroSubtitle}>COLLECTION 2026</Text>
              <Text style={styles.heroTitle}>ELEVATED BASICS</Text>
              <Text style={styles.heroDescription}>
                Precision tailoring, uncompromised natural fabrics. Designed in New York.
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.heroCta}
                onPress={() => setSelectedCategory('cat-all')}
              >
                <Text style={styles.heroCtaText}>EXPLORE CAPSULE</Text>
              </TouchableOpacity>
            </View>
          </ImageBackground>
        </View>

        {/* Category Horizontal Filter Pills */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.7}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={[styles.categoryPill, isSelected && styles.categoryPillSelected]}
                >
                  <Text
                    style={[styles.categoryPillText, isSelected && styles.categoryPillTextSelected]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>FEATURED RELEASES</Text>
            <Text style={styles.sectionSubtitle}>
              Curated everyday garments crafted for longevity
            </Text>
          </View>
          <Text style={styles.itemCountText}>{products.length} Items</Text>
        </View>

        {/* 2-Column Product Grid */}
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

        {/* Brand Philosophy Card */}
        <View style={styles.brandCard}>
          <Text style={styles.brandCardSubtitle}>OUR COMMITMENT</Text>
          <Text style={styles.brandCardTitle}>DELIVERED TO YOUR DOOR</Text>
          <Text style={styles.brandCardBody}>
            Every order is delivered to your US address. Your delivery estimate is shown at
            checkout.
          </Text>
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
  heroWrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    height: 220,
    backgroundColor: '#18181B',
  },
  heroBackground: {
    width: '100%',
    height: '100%',
  },
  heroImage: {
    borderRadius: 12,
    opacity: 0.72,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
    padding: 20,
    justifyContent: 'flex-end',
  },
  heroSubtitle: {
    color: '#D4D4D8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroDescription: {
    color: '#E4E4E7',
    fontSize: 12,
    lineHeight: 16,
    maxWidth: '85%',
    marginBottom: 14,
  },
  heroCta: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  heroCtaText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  categoryPillSelected: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  categoryPillTextSelected: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#09090B',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  itemCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A1A1AA',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  gridItem: {
    width: '50%',
  },
  brandCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#18181B',
    borderRadius: 12,
    padding: 20,
  },
  brandCardSubtitle: {
    color: '#A1A1AA',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  brandCardTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  brandCardBody: {
    color: '#D4D4D8',
    fontSize: 12,
    lineHeight: 18,
  },
});
