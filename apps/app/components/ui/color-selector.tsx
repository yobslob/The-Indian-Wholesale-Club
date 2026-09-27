import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ColorOption {
  name: string;
  hex: string;
}

export interface ColorSelectorProps {
  colors: ColorOption[];
  selectedColor?: string | null;
  onSelect: (colorName: string) => void;
}

export function ColorSelector({
  colors,
  selectedColor,
  onSelect,
}: ColorSelectorProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>SELECT COLOR</Text>
        {selectedColor && <Text style={styles.selectedName}>{selectedColor}</Text>}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {colors.map((color) => {
          const isSelected = selectedColor === color.name;

          return (
            <TouchableOpacity
              key={color.name}
              activeOpacity={0.8}
              onPress={() => onSelect(color.name)}
              style={[styles.swatchBorder, isSelected && styles.swatchBorderSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: color.hex }]}>
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={color.hex.toLowerCase() === '#ffffff' ? '#18181B' : '#FFFFFF'}
                  />
                )}
              </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#71717A',
  },
  selectedName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#18181B',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 10,
  },
  swatchBorder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchBorderSelected: {
    borderColor: '#18181B',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
});
