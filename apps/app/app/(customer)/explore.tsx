import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getHome, getTypeRows, searchProducts } from '@repo/db/store';

import { Body, Button, ErrorText, Field, Loading, Screen, Title } from '@/components/ui';
import { Grid, ProductCard, RegionCard } from '@/features/catalog/cards';
import { ProductRow } from '@/features/catalog/product-row';
import { supabase } from '@/lib/supabase';
import { usePagedQuery } from '@/lib/use-paged-query';
import { useQuery } from '@/lib/use-query';

type Tab = 'states' | 'clothing' | 'spice';
const TABS: { key: Tab; label: string }[] = [
  { key: 'states', label: 'States' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'spice', label: 'Spices' },
];

/**
 * Explore (storefront.md): states A–Z, clothing and spices as one sideways row per category with See all (D-062),
 * and search. A tab reads only each category's first 12 cards (store_type_rows); search results come 24 at a time
 * with "Show more", so no view downloads the whole catalogue.
 */
export default function ExploreScreen(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('states');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const view = useQuery(submitted ? `explore:search-states:${submitted}` : `explore:${tab}`, async () => {
    if (submitted || tab === 'states') {
      const home = await getHome(supabase);
      const needle = submitted.toLowerCase();
      const regions = submitted ? home.regions.filter((r) => r.name.toLowerCase().includes(needle)) : home.regions;
      return { regions: [...regions].sort((a, b) => a.name.localeCompare(b.name, 'en')), rows: [] };
    }
    return { regions: [], rows: await getTypeRows(supabase, tab) };
  });
  const search = usePagedQuery(`explore:search:${submitted}`, (offset, limit) =>
    submitted ? searchProducts(supabase, submitted, { offset, limit }) : Promise.resolve([]),
  );
  const data = view.data;
  const products = submitted ? (search.items ?? []) : [];
  const loading = view.loading || (Boolean(submitted) && search.loading);
  const reload = (): void => {
    view.reload();
    search.reload();
  };

  return (
    <Screen back={false} refreshing={loading} onRefresh={reload}>
      <Title>Explore</Title>
      <Field
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="A state, a saree, a spice…"
        returnKeyType="search"
        onSubmitEditing={() => setSubmitted(query.trim().slice(0, 100))}
      />
      {!submitted ? (
        <View className="flex-row gap-2">
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              className={`min-h-11 justify-center rounded-sm border px-3 ${tab === t.key ? 'border-ink bg-ink' : 'border-line'}`}
            >
              <Text className={tab === t.key ? 'text-canvas text-sm' : 'text-ink text-sm'}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Pressable
          onPress={() => {
            setSubmitted('');
            setQuery('');
          }}
          className="min-h-11 justify-center"
        >
          <Text className="text-ink text-sm underline">Clear search</Text>
        </Pressable>
      )}
      {view.error ?? search.error ? <ErrorText>{view.error ?? search.error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data?.regions.map((r) => (
        <RegionCard key={r.slug} region={r} />
      ))}
      {products.length > 0 ? (
        <Grid>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Grid>
      ) : null}
      {submitted && search.hasMore ? (
        <Button
          kind="secondary"
          label={search.loadingMore ? 'Loading…' : 'Show more'}
          disabled={search.loadingMore}
          onPress={search.loadMore}
        />
      ) : null}
      {!submitted
        ? data?.rows.map((row) => (
            <ProductRow
              key={row.slug}
              title={row.name}
              products={row.products}
              seeAll={row.count > row.products.length ? { type: tab === 'spice' ? 'spice' : 'clothing', category: row.slug } : undefined}
            />
          ))
        : null}
      {data && !loading && data.regions.length === 0 && data.rows.length === 0 && products.length === 0 ? (
        <Body muted>
          {submitted
            ? `Nothing matches “${submitted}”.`
            : tab === 'spice'
              ? 'Spices are coming soon.'
              : 'New pieces are on their way.'}
        </Body>
      ) : null}
    </Screen>
  );
}
