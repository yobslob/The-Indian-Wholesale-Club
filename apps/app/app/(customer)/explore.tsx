import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { getHome, getTypeRows, searchProducts } from '@repo/db/store';
import tokens from '@repo/tokens';

import type { RegionCard } from '@repo/db/store';

import { Body, Button, ErrorText, Heading, Label, Loading, Screen } from '@/components/ui';
import { Grid, ProductCard } from '@/features/catalog/cards';
import { ProductRow } from '@/features/catalog/product-row';
import { StampGrid } from '@/features/regions/stamps';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

type Tab = 'states' | 'clothing' | 'spice';
const TABS: { key: Tab; label: string }[] = [
  { key: 'states', label: 'States' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'spice', label: 'Spices' },
];
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Every other state by name (the website's "Coming soon" list). */
function SoonNames({ regions }: { regions: RegionCard[] }): React.JSX.Element {
  return (
    <View className="flex-row flex-wrap">
      {regions.map((r) => (
        <Link key={r.slug} href={{ pathname: '/region/[slug]', params: { slug: r.slug } }} asChild>
          <Pressable className="min-h-10 w-1/2 justify-center pr-2">
            <Text className="font-body text-ink-muted text-[13.5px]">{r.name}</Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

/**
 * Explore (storefront.md, D-083 – D-085, D-095): search, then States · Clothing · Spices. States are the open ones as
 * stamps and every other by name; Clothing and Spices are one sideways row per category with See all (D-062). A search
 * shows the count with the words, matching open states as stamps, the pieces 24 at a time, and on no results the open
 * states, so it is never a dead end. A tab reads only each category's first 12 cards (store_type_rows).
 */
export default function ExploreScreen(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('states');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const home = useQuery('home', () => getHome(supabase));
  const rows = useQuery(`explore:${tab}`, async () => (tab === 'states' ? [] : getTypeRows(supabase, tab)));
  const search = usePagedQuery(`explore:search:${submitted}`, (offset, limit) =>
    submitted ? searchProducts(supabase, submitted, { offset, limit }) : Promise.resolve([]),
  );
  const regions = [...(home.data?.regions ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const open = regions.filter((r) => r.is_live);
  const needle = submitted.toLowerCase();
  const matched = submitted ? regions.filter((r) => r.name.toLowerCase().includes(needle)) : [];
  const pieces = search.items ?? [];
  const loading = home.loading || rows.loading || (Boolean(submitted) && search.loading);
  const nothing = submitted && !search.loading && pieces.length === 0 && matched.length === 0;
  const submit = (): void => setSubmitted(query.trim().slice(0, 100));
  const reload = (): void => {
    home.reload();
    rows.reload();
    search.reload();
  };

  return (
    <Screen back={false} title="Explore" refreshing={loading} onRefresh={reload}>
      <View className="border-line bg-paper min-h-[46px] flex-row items-center gap-2 rounded-pill border pl-4 pr-1">
        <Ionicons name="search-outline" size={18} color={tokens.colors['ink-muted']} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="A state, a saree, a spice…"
          placeholderTextColor={tokens.colors['ink-muted']}
          accessibilityLabel="Search"
          returnKeyType="search"
          onSubmitEditing={submit}
          className="font-ui text-ink min-h-11 flex-1 text-[15px]"
        />
        {submitted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => {
              setSubmitted('');
              setQuery('');
            }}
            className="h-10 w-10 items-center justify-center"
          >
            <Ionicons name="close" size={18} color={tokens.colors.ink} />
          </Pressable>
        ) : null}
      </View>

      {submitted ? (
        <Text className="font-body text-ink-muted -mt-2 text-[15px]" accessibilityLiveRegion="polite">
          {matched.length > 0 ? <Text className="font-ui text-ink">{plural(matched.length, 'state')}</Text> : null}
          {matched.length > 0 && pieces.length > 0 ? ' and ' : null}
          {pieces.length > 0 || matched.length === 0 ? (
            <Text className="font-ui text-ink">{search.hasMore ? `${pieces.length}+ pieces` : plural(pieces.length, 'piece')}</Text>
          ) : null}{' '}
          for “{submitted}”
        </Text>
      ) : (
        <View className="bg-surface flex-row rounded-pill p-1">
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              onPress={() => setTab(t.key)}
              className={`min-h-[38px] flex-1 items-center justify-center rounded-pill ${tab === t.key ? 'border-line bg-paper border' : ''}`}
            >
              <Text className={`font-ui text-sm ${tab === t.key ? 'text-ink' : 'text-ink-muted'}`}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {home.error ?? rows.error ?? search.error ? <ErrorText>{home.error ?? rows.error ?? search.error}</ErrorText> : null}
      {loading && !home.data ? <Loading /> : null}

      {submitted ? (
        <>
          {matched.length > 0 ? (
            <View className="gap-3">
              <Heading>States</Heading>
              {matched.some((r) => r.is_live) ? <StampGrid regions={matched.filter((r) => r.is_live)} delivery={home.data?.delivery ?? null} /> : null}
              {matched.some((r) => !r.is_live) ? (
                <Text className="font-ui text-ink-muted text-sm">Coming soon: {matched.filter((r) => !r.is_live).map((r) => r.name).join(', ')}</Text>
              ) : null}
            </View>
          ) : null}
          {pieces.length > 0 ? (
            <View className="gap-3">
              <Heading>Products</Heading>
              <Grid>
                {pieces.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </Grid>
            </View>
          ) : null}
          {search.hasMore ? (
            <Button kind="secondary" label={search.loadingMore ? 'Loading…' : 'Show more'} disabled={search.loadingMore} onPress={search.loadMore} />
          ) : null}
          {nothing ? (
            <View className="gap-3">
              <Body muted>No products match “{submitted}”.</Body>
              <Label>Open now</Label>
              <StampGrid regions={open} delivery={home.data?.delivery ?? null} />
            </View>
          ) : null}
        </>
      ) : tab === 'states' ? (
        home.data ? (
          <>
            <View className="gap-3">
              <Label>Open now</Label>
              <StampGrid regions={open} delivery={home.data.delivery} />
            </View>
            <View className="gap-2">
              <Label>Coming soon</Label>
              <SoonNames regions={regions.filter((r) => !r.is_live)} />
            </View>
          </>
        ) : null
      ) : (
        <>
          {(rows.data ?? []).map((row) => (
            <ProductRow
              key={row.slug}
              title={row.name}
              products={row.products}
              seeAll={row.count > row.products.length ? { type: tab === 'spice' ? 'spice' : 'clothing', category: row.slug } : undefined}
            />
          ))}
          {rows.data && rows.data.length === 0 ? <Body muted>{tab === 'spice' ? 'Spices are coming soon.' : 'New pieces are on their way.'}</Body> : null}
        </>
      )}
    </Screen>
  );
}
