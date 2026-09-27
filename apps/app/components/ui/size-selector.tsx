import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface SizeSelectorProps {
  sizes: string[];
  selectedSize?: string | null;
  onSelect: (size: string) => void;
  outOfStockSizes?: string[];
}

export function SizeSelector({
  sizes,
  selectedSize,
  onSelect,
  outOfStockSizes = [],
}: SizeSelectorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>SELECT SIZE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sizes.map((size) => {
          const isSelected = selectedSize === size;
          const isOutOfStock = outOfStockSizes.includes(size);

          return (
            <TouchableOpacity
              key={size}
              activeOpacity={0.7}
              onPress={() => !isOutOfStock && onSelect(size)}
              disabled={isOutOfStock}
              style={[
                styles.sizePill,
                isSelected && styles.sizePillSelected,
                isOutOfStock && styles.sizePillDisabled,
              ]}
            >
              <Text
                style={[
                  styles.sizeText,
                  isSelected && styles.sizeTextSelected,
                  isOutOfStock && styles.sizeTextDisabled,
                ]}
              >
                {size}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
    marginBottom: 8,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 8,
  },
  sizePill: {
    minWidth: 46,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizePillSelected: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  sizePillDisabled: {
    backgroundColor: '#F4F4F5',
    borderColor: '#E4E4E7',
    opacity: 0.45,
  },
  sizeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#18181B',
  },
  sizeTextSelected: {
    color: '#FFFFFF',
  },
  sizeTextDisabled: {
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
  },
});
