import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getHome, listProducts } from '@repo/db/store';

import { Body, ErrorText, Field, Loading, Screen, Title } from '@/components/ui';
import { Grid, ProductCard, RegionCard } from '@/features/catalog/cards';
import { byCategory, ProductRow } from '@/features/catalog/product-row';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

type Tab = 'states' | 'clothing' | 'spice';
const TABS: { key: Tab; label: string }[] = [
  { key: 'states', label: 'States' },
  { key: 'clothing', label: 'Clothing' },
  { key: 'spice', label: 'Spices' },
];

/**
 * Explore (storefront.md): states A–Z, clothing and spices as one sideways row per category with See all (D-062),
 * and search. One store_* read per view.
 */
export default function ExploreScreen(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>('states');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const key = submitted ? `search:${submitted}` : tab;
  const { data, error, loading, reload } = useQuery(key, async () => {
    if (submitted) {
      const [home, products] = await Promise.all([
        getHome(supabase),
        listProducts(supabase, { search: submitted, limit: 40 }),
      ]);
      const needle = submitted.toLowerCase();
      return {
        regions: home.regions.filter((r) => r.name.toLowerCase().includes(needle)),
        products,
      };
    }
    if (tab === 'states') {
      const home = await getHome(supabase);
      return {
        regions: [...home.regions].sort((a, b) => a.name.localeCompare(b.name, 'en')),
        products: [],
      };
    }
    return {
      regions: [],
      products: await listProducts(supabase, { productType: tab, sort: 'newest', limit: 500 }),
    };
  });

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
              <Text className={tab === t.key ? 'text-canvas text-sm' : 'text-ink text-sm'}>
                {t.label}
              </Text>
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
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data?.regions.map((r) => (
        <RegionCard key={r.slug} region={r} />
      ))}
      {data && data.products.length > 0 && submitted ? (
        <Grid>
          {data.products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </Grid>
      ) : null}
      {data && data.products.length > 0 && !submitted
        ? byCategory(data.products).map((c) => (
            <ProductRow key={c.slug} title={c.name} products={c.items.slice(0, 12)} seeAll={{ type: tab === 'spice' ? 'spice' : 'clothing', category: c.slug }} />
          ))
        : null}
      {data && !loading && data.regions.length === 0 && data.products.length === 0 ? (
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
