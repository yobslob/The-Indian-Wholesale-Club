import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { formatDeliveryWindow } from '@repo/shared/domain';
import { INDIA_MAP, TINY_REGIONS } from '@repo/shared/india-map';
import tokens from '@repo/tokens';

import type { DeliveryWindow, RegionCard } from '@repo/db/store';

import { Label } from '@/components/ui';
import { mediaUrl } from '@/lib/supabase';

const accentOf = (r: RegionCard | undefined): string => r?.accent_color ?? tokens.colors.brand;

function Stamp({ region, postmark, index }: { region: RegionCard; postmark: string; index: number }): React.JSX.Element {
  const rotate = [-14, 9, -4][index % 3];
  return (
    <Link href={{ pathname: '/region/[slug]', params: { slug: region.slug } }} asChild>
      <Pressable accessibilityLabel={`${region.name}, open now`} className="w-[31%]">
        <View className="border-line bg-paper rounded-sm border-2 border-dotted p-1.5">
          <View className="aspect-[4/5] overflow-hidden" style={{ backgroundColor: accentOf(region) }}>
            {region.hero_image_path ? (
              <Image source={mediaUrl(region.hero_image_path)} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
            ) : null}
          </View>
          <Text numberOfLines={1} className="font-display text-ink mt-1.5 text-[15px]">
            {region.name}
          </Text>
        </View>
        <View pointerEvents="none" className="absolute -right-2 -top-3" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
          <Svg width={52} height={52} viewBox="0 0 100 100" opacity={0.75}>
            <Defs>
              <Path id={`pm-${region.slug}`} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" />
            </Defs>
            <Circle cx="50" cy="50" r="47" fill="none" stroke={tokens.colors.brand} strokeWidth="2" />
            <Circle cx="50" cy="50" r="25" fill="none" stroke={tokens.colors.brand} strokeWidth="1.2" />
            {postmark ? (
              <SvgText fill={tokens.colors.brand} fontSize="9" fontFamily="Montserrat_600SemiBold" letterSpacing="1">
                <TextPath href={`#pm-${region.slug}`}>{postmark}</TextPath>
              </SvgText>
            ) : null}
            <SvgText x="50" y="55" textAnchor="middle" fill={tokens.colors.brand} fontSize="13" fontFamily="Gelasio_400Regular_Italic">
              IWC
            </SvgText>
          </Svg>
        </View>
      </Pressable>
    </Link>
  );
}

/**
 * "Pick your home" on a phone (D-050 – D-052): the India map (tap a state to see its name and open it), the open
 * regions as postage stamps postmarked with the next delivery window, and every other region by name, with a
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
  const postmark = delivery
    ? `ARRIVES ${formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to).toUpperCase()} · `.repeat(2)
    : '';
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
          <View className="flex-row justify-between">
            {live.map((r, i) => (
              <Stamp key={r.slug} region={r} postmark={postmark} index={i} />
            ))}
          </View>
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
