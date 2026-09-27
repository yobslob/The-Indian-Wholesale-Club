import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { ProductCard, type ProductCardProps } from './product-card';

export interface ProductGridProps {
  data: ProductCardProps[];
  numColumns?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  emptyMessage?: string;
}

export function ProductGrid({
  data,
  numColumns = 2,
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
  emptyMessage = 'No products found.',
}: ProductGridProps): React.JSX.Element {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      renderItem={({ item }) => <ProductCard {...item} />}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#18181B"
            colors={['#18181B']}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
});
