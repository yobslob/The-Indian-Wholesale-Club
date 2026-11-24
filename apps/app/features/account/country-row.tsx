import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import tokens from '@repo/tokens';

import { countryNameOf, setCountry, useCountry } from '@/features/shell/country';

/** A country's flag as Android draws it (two regional-indicator letters; the website uses SVGs, D-199). */
const flagOf = (code: string): string =>
  String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/**
 * D-208 in the app: the shopper's country on Profile, always (signed in or not): its flag and name, and Change, which
 * lists every country IWC sells in with a search field. A pick is kept on the phone and every price follows.
 */
export function CountryRow(): React.JSX.Element {
  const { country, countries } = useCountry();
  const [open, setOpen] = useState(false);
  const [find, setFind] = useState('');
  const q = find.trim().toLowerCase();
  const list = q ? countries.filter((c) => c.name.toLowerCase().includes(q) || c.code === q) : countries;
  return (
    <View className="bg-paper border-line mb-4 rounded-lg border p-3.5">
      <View className="flex-row items-center gap-3">
        <Text className="text-[22px]">{flagOf(country)}</Text>
        <View className="flex-1">
          <Text className="font-ui text-ink-muted text-[12px]">Country</Text>
          <Text className="font-ui-semibold text-ink text-[15px]">{countryNameOf(countries, country)}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} className="min-h-11 justify-center px-1">
          <Text className="font-ui-semibold text-ink text-sm underline">{open ? 'Close' : 'Change'}</Text>
        </Pressable>
      </View>
      {open ? (
        <View className="mt-3 gap-2">
          <TextInput
            value={find}
            onChangeText={setFind}
            placeholder="Search countries"
            placeholderTextColor={tokens.colors['ink-muted']}
            accessibilityLabel="Search countries"
            className="border-line bg-paper text-ink font-ui min-h-11 rounded-[10px] border px-3 text-[15px]"
          />
          <ScrollView className="max-h-80" nestedScrollEnabled>
            {list.map((c) => (
              <Pressable
                key={c.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: c.code === country }}
                onPress={() => {
                  setCountry(c.code);
                  setOpen(false);
                  setFind('');
                }}
                className={`mb-1.5 min-h-11 flex-row items-center gap-3 rounded-[12px] border px-3 ${c.code === country ? 'border-brand bg-canvas' : 'border-line'}`}
              >
                <Text className="text-[18px]">{flagOf(c.code)}</Text>
                <Text className="font-ui text-ink flex-1 text-[15px]">{c.name}</Text>
                {c.code === country ? <Text className="text-ink">✓</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
