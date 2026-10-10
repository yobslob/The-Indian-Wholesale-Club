import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SIZE_PRESETS, WEARS, type PhotoView, type Wears } from '@repo/shared/vendor';
import tokens from '@repo/tokens';

import { useVendor } from './context';

import type { TakenPhoto } from './photo';

export type Category = { id: string; name: string; product_type: 'clothing' | 'spice' };
export type Details = { sizes: { label: string; qty: number }[]; price: string; fabric: string; care: string; colour: string; note: string };

const pill = (on: boolean): string => `min-h-12 justify-center rounded-md border px-3 ${on ? 'border-brand bg-brand' : 'border-line bg-paper'}`;
const pillText = (on: boolean): string => `font-ui text-[15px] ${on ? 'text-on-brand' : 'text-ink'}`;
const WEARS_ICON: Record<Wears, keyof typeof Ionicons.glyphMap> = { women: 'woman-outline', men: 'man-outline', kids: 'happy-outline', unisex: 'people-outline' };

/** What it is (big tiles) and who wears it (four pictures; clothing only). */
export function ChooseStep({ categories, category, wears, onCategory, onWears }: {
  categories: Category[]; category: Category | null; wears: Wears | null; onCategory: (c: Category) => void; onWears: (w: Wears) => void;
}): React.JSX.Element {
  const { w } = useVendor();
  return (
    <View className="gap-5">
      <Text className="font-heading text-ink text-[22px]">{w('what_is_it')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {categories.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: category?.id === c.id }} onPress={() => onCategory(c)} className={`${pill(category?.id === c.id)} w-[48%]`}>
            <Text className={pillText(category?.id === c.id)}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
      {category?.product_type === 'clothing' ? (
        <>
          <Text className="font-heading text-ink text-[22px]">{w('who_wears')}</Text>
          <View className="flex-row gap-2">
            {WEARS.map((x) => (
              <Pressable key={x} accessibilityRole="button" accessibilityState={{ selected: wears === x }} onPress={() => onWears(x)} className={`${pill(wears === x)} min-h-20 flex-1 items-center gap-1`}>
                <Ionicons name={WEARS_ICON[x]} size={28} color={wears === x ? tokens.colors['on-brand'] : tokens.colors.ink} />
                <Text className={pillText(wears === x)}>{w(`wears_${x}`)}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

const SHOOT = { front: 'shoot_front', back: 'shoot_back', closeup: 'shoot_closeup' } as const;
const VIEW = { front: 'view_front', back: 'view_back', closeup: 'view_closeup' } as const;
const ISSUE = { small: 'check_small', dark: 'check_dark', bright: 'check_bright', blurry: 'check_blurry' } as const;

/** One photo: the words, Take photo (camera) or the gallery, the instant check; a weak photo asks to take it again. */
export function PhotoStep({ view, step, total, shot, existing, busy, onTake, onUse }: {
  view: PhotoView; step: number; total: number; shot: TakenPhoto | null; existing?: string; busy: boolean;
  onTake: (source: 'camera' | 'library') => void; onUse: () => void;
}): React.JSX.Element {
  const { w } = useVendor();
  const preview = shot?.uri ?? existing;
  return (
    <View className="gap-4">
      <Text className="font-ui text-ink-muted text-[13px]">{w('step_of', { n: step, total })}</Text>
      <Text className="font-heading text-ink text-[22px]">{w(VIEW[view])}</Text>
      {preview ? <Image source={{ uri: preview }} style={{ width: '100%', height: 320, borderRadius: 14 }} contentFit="contain" /> : null}
      {shot ? shot.checks.issues.map((i) => <Text key={i} className="font-ui text-danger text-[15px]">⚠ {w(ISSUE[i])}</Text>) : (
        <View className="bg-paper border-line gap-2 rounded-lg border p-4">
          <Text className="font-body text-ink text-[17px] leading-6">{w(SHOOT[view])}</Text>
          <Text className="font-body text-ink-muted text-[13px]">{w('tips')}</Text>
          {view === 'front' ? <Text className="font-body text-ink-muted text-[13px]">{w('set_tip')}</Text> : null}
        </View>
      )}
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => onTake('camera')} className={`bg-brand min-h-16 flex-row items-center justify-center gap-2 rounded-lg ${busy ? 'opacity-60' : ''}`}>
        <Ionicons name="camera-outline" size={26} color={tokens.colors['on-brand']} />
        <Text className="font-ui text-on-brand text-[18px]">{busy ? '…' : w(shot || existing ? 'retake' : 'take_photo')}</Text>
      </Pressable>
      <Pressable disabled={busy} accessibilityRole="button" onPress={() => onTake('library')} className="min-h-11 items-center justify-center">
        <Ionicons name="images-outline" size={22} color={tokens.colors['ink-muted']} />
      </Pressable>
      {shot || existing ? (
        <Pressable disabled={busy} accessibilityRole="button" onPress={onUse} className="border-line min-h-12 items-center justify-center rounded-lg border">
          <Text className="font-ui text-ink text-[15px]">{w('next')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Sizes with + / −, the shop's price in ₹, the optional words. */
export function DetailsStep({ value, onChange }: { value: Details; onChange: (d: Details) => void }): React.JSX.Element {
  const { w } = useVendor();
  const has = (l: string): boolean => value.sizes.some((s) => s.label === l);
  const toggle = (l: string): void => onChange({ ...value, sizes: has(l) ? value.sizes.filter((s) => s.label !== l) : [...value.sizes, { label: l, qty: 1 }] });
  const qty = (l: string, d: number): void => onChange({ ...value, sizes: value.sizes.map((s) => (s.label === l ? { ...s, qty: Math.min(999, Math.max(1, s.qty + d)) } : s)) });
  const input = 'border-line bg-paper text-ink font-body min-h-12 rounded-md border px-3 text-[17px]';
  return (
    <View className="gap-4">
      <Text className="font-heading text-ink text-[22px]">{w('sizes')}</Text>
      <View className="flex-row flex-wrap gap-2">
        {SIZE_PRESETS.map((l) => (
          <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: has(l) }} onPress={() => toggle(l)} className={`${pill(has(l))} min-w-14 items-center`}>
            <Text className={pillText(has(l))}>{l}</Text>
          </Pressable>
        ))}
      </View>
      {value.sizes.map((s) => (
        <View key={s.label} className="border-line bg-paper flex-row items-center justify-between rounded-md border px-3 py-1">
          <Text className="font-ui text-ink text-[17px]">{s.label}</Text>
          <View className="flex-row items-center gap-3">
            <Pressable accessibilityLabel="−" onPress={() => qty(s.label, -1)} className="border-line h-11 w-11 items-center justify-center rounded-full border"><Ionicons name="remove" size={20} /></Pressable>
            <Text className="font-ui text-ink min-w-16 text-center text-[17px]">{s.qty} {w('pieces')}</Text>
            <Pressable accessibilityLabel="+" onPress={() => qty(s.label, 1)} className="border-line h-11 w-11 items-center justify-center rounded-full border"><Ionicons name="add" size={20} /></Pressable>
          </View>
        </View>
      ))}
      <Text className="font-heading text-ink text-[18px]">{w('price')}</Text>
      <TextInput accessibilityLabel={w('price')} keyboardType="number-pad" value={value.price} onChangeText={(v) => onChange({ ...value, price: v.replace(/[^0-9]/g, '') })} className={`${input} text-[22px]`} placeholder="₹" />
      {(['fabric', 'care', 'colour', 'note'] as const).map((k) => (
        <TextInput key={k} accessibilityLabel={w(k)} placeholder={`${w(k)} (${w('optional')})`} value={value[k]} onChangeText={(v) => onChange({ ...value, [k]: v })} maxLength={500} className={input} placeholderTextColor={tokens.colors['ink-muted']} />
      ))}
    </View>
  );
}
