import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { formatDeliveryWindow } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import type { DeliveryWindow, RegionCard } from '@repo/db/store';

import { Photo } from '@/components/photo';

/** Stamps per page; from one more than this they page (D-080). */
const PAGE = 6;
const GAP = 8;

/** The postmark's ring text: the next delivery window from cycle data (D-008), or nothing without one. */
export function postmarkFor(delivery: DeliveryWindow | null): string {
  return delivery
    ? `ARRIVES ${formatDeliveryWindow(delivery.est_delivery_from, delivery.est_delivery_to).toUpperCase()} · `.repeat(2)
    : '';
}

/** One open state as a postage stamp (D-051, D-080): its photo, its name in Cinzel, the postmark. */
function Stamp({ region, postmark, index, width }: { region: RegionCard; postmark: string; index: number; width: number }): React.JSX.Element {
  const rotate = [-14, 9, -4][index % 3];
  const ring = `pm-${region.slug}-${index}`;
  return (
    <Link href={{ pathname: '/region/[slug]', params: { slug: region.slug } }} asChild>
      <Pressable accessibilityLabel={`${region.name}, open now`} style={{ width }}>
        <View className="border-line bg-paper rounded-sm border-2 border-dotted p-1.5">
          <View className="aspect-[4/5] overflow-hidden" style={{ backgroundColor: region.accent_color ?? tokens.colors.brand }}>
            {region.hero_image_path ? <Photo path={region.hero_image_path} width={width} transition={150} /> : null}
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit className="font-display text-ink mt-1.5 text-[13px]">
            {region.name}
          </Text>
        </View>
        <View pointerEvents="none" className="absolute -right-2 -top-3" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
          <Svg width={50} height={50} viewBox="0 0 100 100" opacity={0.75}>
            <Defs>
              <Path id={ring} d="M50 50 m-35 0 a35 35 0 1 1 70 0 a35 35 0 1 1 -70 0" />
            </Defs>
            <Circle cx="50" cy="50" r="47" fill="none" stroke={tokens.colors.brand} strokeWidth="2" />
            <Circle cx="50" cy="50" r="25" fill="none" stroke={tokens.colors.brand} strokeWidth="1.2" />
            {postmark ? (
              <SvgText fill={tokens.colors.brand} fontSize="9" fontFamily="Karla_600SemiBold" letterSpacing="1">
                <TextPath href={`#${ring}`}>{postmark}</TextPath>
              </SvgText>
            ) : null}
            <SvgText x="50" y="55" textAnchor="middle" fill={tokens.colors.brand} fontSize="13" fontFamily="Gelasio_400Regular">
              IWC
            </SvgText>
          </Svg>
        </View>
      </Pressable>
    </Link>
  );
}

function Rows({ regions, postmark, width, offset }: { regions: RegionCard[]; postmark: string; width: number; offset: number }): React.JSX.Element {
  const stamp = (width - GAP * 2) / 3;
  return (
    <View className="flex-row flex-wrap" style={{ width, gap: GAP, rowGap: 14 }}>
      {regions.map((r, i) => (
        <Stamp key={r.slug} region={r} postmark={postmark} index={offset + i} width={stamp} />
      ))}
    </View>
  );
}

/**
 * The open states as stamps (D-080): up to 6 in one grid; from 7, pages of 6 (3 × 2) that swipe, with an arrow on
 * each side (hidden at either end) and a page count under them.
 */
export function StampGrid({ regions, delivery }: { regions: RegionCard[]; delivery: DeliveryWindow | null }): React.JSX.Element {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const track = useRef<ScrollView>(null);
  const postmark = postmarkFor(delivery);
  const pages: RegionCard[][] = [];
  for (let i = 0; i < regions.length; i += PAGE) pages.push(regions.slice(i, i + PAGE));
  const go = (to: number): void => {
    track.current?.scrollTo({ x: to * width, animated: true });
    setPage(to);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width === 0 ? null : pages.length <= 1 ? (
        <Rows regions={regions} postmark={postmark} width={width} offset={0} />
      ) : (
        <View className="gap-3">
          <ScrollView
            ref={track}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            contentContainerStyle={{ paddingTop: 12 }}
          >
            {pages.map((p, i) => (
              <Rows key={i} regions={p} postmark={postmark} width={width} offset={i * PAGE} />
            ))}
          </ScrollView>
          <View className="flex-row items-center justify-center gap-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous states"
              disabled={page === 0}
              onPress={() => go(page - 1)}
              className={`border-line bg-paper h-10 w-10 items-center justify-center rounded-full border ${page === 0 ? 'opacity-0' : ''}`}
            >
              <Ionicons name="arrow-back" size={16} color={tokens.colors.ink} />
            </Pressable>
            <Text className="font-ui text-ink-muted text-xs" accessibilityLiveRegion="polite">
              {page + 1} / {pages.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More states"
              disabled={page === pages.length - 1}
              onPress={() => go(page + 1)}
              className={`border-line bg-paper h-10 w-10 items-center justify-center rounded-full border ${page === pages.length - 1 ? 'opacity-0' : ''}`}
            >
              <Ionicons name="arrow-forward" size={16} color={tokens.colors.ink} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
