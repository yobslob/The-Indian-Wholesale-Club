import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PRODUCT_TYPE_LABEL } from '@repo/shared/domain';
import { EMPTY_HINTS, parseHints, suggest, type SearchHints, type Suggestion } from '@repo/shared/search';
import tokens from '@repo/tokens';

import { API_BASE_URL } from '@/lib/api';

let hintsOnce: Promise<SearchHints> | null = null;

/**
 * The website's suggestion list (D-160, GET /api/search/hints): the same words, states and categories as the website's
 * boxes, read once per app session from the CDN (not Supabase: no egress on the free plan's budget per keystroke).
 */
function loadHints(): Promise<SearchHints> {
  hintsOnce ??= fetch(`${API_BASE_URL}/api/search/hints`)
    .then(async (r) => (r.ok ? parseHints(await r.json()) : EMPTY_HINTS))
    .catch(() => {
      hintsOnce = null;
      return EMPTY_HINTS;
    });
  return hintsOnce;
}

export function useSearchHints(): SearchHints {
  const [hints, setHints] = useState<SearchHints>(EMPTY_HINTS);
  useEffect(() => {
    let live = true;
    void loadHints().then((h) => live && setHints(h));
    return () => {
      live = false;
    };
  }, []);
  return hints;
}

const ICON = { search: 'search-outline', state: 'location-outline', category: 'pricetag-outline' } as const;

/** Suggestions under Explore's box while typing (the website's, packages/shared/src/search): a tap takes one. */
export function SearchSuggestions({
  text,
  hints,
  onPick,
}: {
  text: string;
  hints: SearchHints;
  onPick: (s: Suggestion) => void;
}): React.JSX.Element | null {
  const items = useMemo(() => suggest(text, hints, { limit: 6 }), [text, hints]);
  if (!items.length) return null;
  return (
    <View className="border-line bg-paper -mt-2 rounded-md border p-1" accessibilityLabel="Suggestions">
      {items.map((s) => (
        <Pressable
          key={`${s.kind}:${s.label}`}
          accessibilityRole="button"
          accessibilityLabel={s.kind === 'search' ? `Search ${s.label}` : `${s.label}, ${s.kind === 'state' ? 'state' : PRODUCT_TYPE_LABEL[s.type]}`}
          onPress={() => onPick(s)}
          className="min-h-11 flex-row items-center gap-3 rounded-sm px-3"
        >
          <Ionicons name={ICON[s.kind]} size={16} color={tokens.colors['ink-muted']} />
          <Text className="font-ui text-ink flex-1 text-[15px]" numberOfLines={1}>
            {s.label}
          </Text>
          {s.kind !== 'search' ? (
            <Text className="font-ui text-ink-muted text-xs">{s.kind === 'state' ? 'State' : PRODUCT_TYPE_LABEL[s.type]}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
