import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { INDIA_MAP, TINY_REGIONS } from '@repo/shared/india-map';
import tokens from '@repo/tokens';

import { StampGrid } from './stamps';

import type { DeliveryWindow, RegionCard } from '@repo/db/store';

import { Label } from '@/components/ui';


const accentOf = (r: RegionCard | undefined): string => r?.accent_color ?? tokens.colors.brand;

/**
 * "Pick your home" on a phone (D-050 – D-052): the India map (tap a state to see its name and open it), the open
 * regions as postage stamps postmarked with the next delivery window (pages of 6 from 7, D-080), and every other region by name, with a
 * search that filters all three. The map credit stays visible (CC BY 4.0).
 */
export function PickHome({ regions, delivery }: { regions: RegionCard[]; delivery: DeliveryWindow | null }): React.JSX.Element {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map(regions.map((r) => [r.slug, r])), [regions]);
  const q = query.trim().toLowerCase();
  const matches = (r: RegionCard | undefined): boolean => !q || (r?.name.toLowerCase().includes(q) ?? false);
  const live = regions.filter((r) => r.is_live && matches(r));
  const soon = regions.filter((r) => !r.is_live && matches(r)).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const chosen = selected ? bySlug.get(selected) : undefined;

  const fill = (slug: string): string => {
    const r = bySlug.get(slug);
    if (slug === selected) return r?.is_live ? tokens.colors.ink : tokens.colors['ink-muted'];
    return r?.is_live ? accentOf(r) : tokens.colors.land;
  };
  const opacity = (slug: string): number => (q && !matches(bySlug.get(slug)) ? 0.35 : 1);

  return (
    <View className="gap-5">
      <View className="bg-surface gap-3 rounded-lg p-3">
        <Svg width="100%" height={undefined} viewBox={INDIA_MAP.viewBox} style={{ aspectRatio: 1000 / 1124 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Object.entries(INDIA_MAP.paths).map(([slug, d]) => (
            <Path key={slug} d={d} fill={fill(slug)} opacity={opacity(slug)} stroke={tokens.colors.paper} strokeWidth={1.3} onPress={() => setSelected(slug)} />
          ))}
          {TINY_REGIONS.map((slug) => {
            const [cx = 0, cy = 0] = INDIA_MAP.centers[slug] ?? [];
            return <Circle key={slug} cx={cx} cy={cy} r={12} fill={fill(slug)} opacity={opacity(slug)} stroke={tokens.colors['ink-muted']} strokeWidth={1.5} onPress={() => setSelected(slug)} />;
          })}
        </Svg>
        {chosen ? (
          <View className="bg-ink flex-row items-center justify-between gap-3 rounded-md px-3.5 py-2.5">
            <View className="flex-1">
              <Text className="font-ui-semibold text-paper text-[14px]">{chosen.name}</Text>
              <Text className="font-ui text-paper text-[11px] uppercase tracking-[1px] opacity-75">
                {chosen.is_live ? 'Open now' : 'Coming soon'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/region/[slug]', params: { slug: chosen.slug } })}
              className="bg-paper min-h-10 justify-center rounded-pill px-4"
            >
              <Text className="font-ui text-ink text-[13px]">Open</Text>
            </Pressable>
          </View>
        ) : (
          <Text className="font-ui text-ink-muted text-xs">Tap a state to see it.</Text>
        )}
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://github.com/datameet/maps')}>
          <Text className="font-ui text-ink-muted text-[11px]">Map: DataMeet India, CC BY 4.0</Text>
        </Pressable>
      </View>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Find your state"
        accessibilityLabel="Find your state"
        placeholderTextColor={tokens.colors['ink-muted']}
        className="border-line bg-paper text-ink font-body min-h-12 rounded-pill border px-5 text-[15px]"
      />

      {live.length > 0 ? (
        <View className="gap-3">
          <Label>Open now</Label>
          <StampGrid regions={live} delivery={delivery} />
        </View>
      ) : null}

      <View className="gap-2">
        <Label>Coming soon</Label>
        {soon.length === 0 ? (
          <Text className="font-body text-ink-muted text-sm">No state or union territory by that name.</Text>
        ) : (
          <View className="flex-row flex-wrap">
            {soon.map((r) => (
              <Link key={r.slug} href={{ pathname: '/region/[slug]', params: { slug: r.slug } }} asChild>
                <Pressable className="min-h-10 w-1/2 justify-center pr-2">
                  <Text className="font-body text-ink-muted text-[13.5px]">{r.name}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
