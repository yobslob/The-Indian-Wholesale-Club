import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { createListing } from '@repo/db/admin';
import {
  autoPrice,
  formatUsd,
  listingInputSchema,
  listingSlug,
  variantLabel,
  type PricingSettings,
} from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { takePhotos, uploadListingPhotos, type ListingPhoto } from './listing-photos';
import { useAction } from './use-action';
import { EMPTY_VARIANT, VariantRows, type VariantDraft } from './variant-rows';

import { Body, Button, ErrorText, Field, Label } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export interface ListingFormData {
  vendors: { id: string; shop_name: string; region: { name: string } | null }[];
  categories: { id: string; product_type: 'clothing' | 'spice'; name: string; is_active: boolean; default_weight_g: number | null }[];
  pricing: PricingSettings;
  /** Some of those settings are still Claude's researched estimates (D-047). */
  pricingEstimated: boolean;
}

const chip = (on: boolean): string =>
  `min-h-11 justify-center rounded-pill border px-4 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`;
const chipText = (on: boolean): string => `font-ui text-[14px] ${on ? 'text-canvas' : 'text-ink'}`;
const toCents = (v: string): number => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100);
const MESSAGES: Record<string, string> = {
  vendor_id: 'Pick the shop.',
  category_id: 'Pick a category.',
  name: 'Give the piece a name (at least 2 letters).',
  price_cents: 'Set the price in dollars.',
  fibre_content: 'Fabric is needed (US labelling), e.g. 100% cotton.',
  care: 'Care is needed, e.g. Hand wash cold.',
  ingredients: 'Ingredients are needed.',
  shelf_life_days: 'Shelf life in days is needed.',
};

/**
 * A new listing from a phone at the shop (flows.md §2, C3; the approved admin mockup): shop, photos, type, category,
 * name, details, variants with pieces, prices with the suggestion. Saved as a draft in one database transaction;
 * the photos go up after it, and any that fail can be sent again.
 */
export function ListingForm({ data, onDone }: { data: ListingFormData; onDone: () => void }): React.JSX.Element {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [shopQuery, setShopQuery] = useState('');
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [type, setType] = useState<'clothing' | 'spice'>('clothing');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', summary: '', fibre: '', care: '', ingredients: '', allergens: '', shelfLife: '', weight: '', shopPrice: '', price: '' });
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; failed: ListingPhoto[] } | null>(null);
  const action = useAction();
  const set = (key: keyof typeof f) => (text: string) => setF((v) => ({ ...v, [key]: text }));

  const vendor = data.vendors.find((v) => v.id === vendorId);
  const q = shopQuery.trim().toLowerCase();
  const shops = q ? data.vendors.filter((v) => `${v.shop_name} ${v.region?.name ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];
  const categories = data.categories.filter((c) => c.product_type === type && c.is_active);
  const weight = Number(f.weight) || null;
  // D-075: the price follows from the shop price and the weight (else the category's typical weight), as the database
  // will set it. A typed price overrides it.
  const category = data.categories.find((c) => c.id === categoryId);
  const autoWeight = weight ?? category?.default_weight_g ?? null;
  const suggestion = f.shopPrice && autoWeight
    ? autoPrice({ shopPricePaise: toCents(f.shopPrice), weightG: Math.round(autoWeight) }, data.pricing)
    : null;

  async function pick(source: 'camera' | 'library'): Promise<void> {
    const result = await takePhotos(source);
    if (result === 'denied') setProblem(`Allow ${source === 'camera' ? 'the camera' : 'photos'} in the phone's settings.`);
    else setPhotos((p) => [...p, ...result]);
  }

  async function save(): Promise<void> {
    setProblem(null);
    if (variants.length === 0) return setProblem('Add at least one variant.');
    const listing = {
      vendor_id: vendorId ?? '',
      category_id: categoryId ?? '',
      product_type: type,
      name: f.name.trim(),
      slug: listingSlug(f.name, Math.random().toString(36).slice(2, 6)),
      summary: f.summary.trim() || undefined,
      price_cents: f.price.trim() ? toCents(f.price) : undefined,
      shop_price_paise: f.shopPrice ? toCents(f.shopPrice) : undefined,
      attributes:
        type === 'clothing'
          ? { fibre_content: f.fibre, care: f.care }
          : { ingredients: f.ingredients, allergens: f.allergens.split(',').map((a) => a.trim()).filter(Boolean), shelf_life_days: Number(f.shelfLife) },
      variants: variants.map((v) => ({
        label: variantLabel(v),
        options: { colour: v.colour.trim() || undefined, size: v.size.trim() || undefined },
        qty: v.qty,
        weight_g: weight ?? undefined,
      })),
    };
    const parsed = listingInputSchema.safeParse(listing);
    if (!parsed.success) {
      const key = String(parsed.error.issues[0]?.path.at(-1) ?? '');
      return setProblem(MESSAGES[key] ?? `Check ${key || 'the form'}.`);
    }
    const named = photos.map((p, i) => ({ ...p, alt: p.alt.trim() || `${f.name.trim()}, photo ${i + 1}` }));
    await action.run(async () => {
      const id = await createListing(supabase, parsed.data);
      const failed = await uploadListingPhotos(id, named);
      setSaved({ id, failed });
      if (failed.length === 0) onDone();
    });
  }

  if (saved && saved.failed.length > 0) {
    return (
      <View className="gap-3">
        <Body>Saved as a draft. {saved.failed.length} photo(s) didn&apos;t upload.</Body>
        <Button
          label="Send the photos again"
          disabled={action.busy}
          onPress={() =>
            void action.run(async () => {
              const failed = await uploadListingPhotos(saved.id, saved.failed, photos.length - saved.failed.length);
              setSaved({ id: saved.id, failed });
              if (failed.length === 0) onDone();
            })
          }
        />
        <Button kind="link" label="Leave them for later" onPress={onDone} />
      </View>
    );
  }

  return (
    <View className="gap-5">
      <View className="gap-2">
        <Label>Shop</Label>
        {vendor ? (
          <Pressable onPress={() => setVendorId(null)} className={chip(true)} accessibilityRole="button" accessibilityHint="Change the shop">
            <Text className={chipText(true)}>{vendor.shop_name} · {vendor.region?.name}</Text>
          </Pressable>
        ) : (
          <>
            <Field label="Find the shop" value={shopQuery} onChangeText={setShopQuery} placeholder="Shop name or state" />
            {shops.map((v) => (
              <Pressable key={v.id} onPress={() => setVendorId(v.id)} className="border-line bg-paper min-h-11 justify-center rounded-md border px-3">
                <Text className="font-body text-ink">{v.shop_name} · {v.region?.name}</Text>
              </Pressable>
            ))}
          </>
        )}
      </View>

      <View className="gap-2">
        <Label>Photos (the first is the main one)</Label>
        <View className="flex-row flex-wrap gap-2">
          {photos.map((p, i) => (
            <View key={p.uri} className="w-[30%] gap-1">
              <View className="bg-land aspect-[3/4] overflow-hidden rounded-md">
                <Image source={p.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              </View>
              <TextInput
                value={p.alt}
                onChangeText={(alt) => setPhotos((all) => all.map((x, j) => (j === i ? { ...x, alt } : x)))}
                placeholder="What it shows"
                placeholderTextColor={tokens.colors['ink-muted']}
                accessibilityLabel={`What photo ${i + 1} shows`}
                className="border-line bg-paper text-ink min-h-10 rounded-md border px-2 text-[13px]"
              />
              <Pressable onPress={() => setPhotos((all) => all.filter((_, j) => j !== i))} accessibilityRole="button" className="min-h-8">
                <Text className="font-ui text-ink-muted text-[12px] underline">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1"><Button kind="secondary" label="Camera" onPress={() => void pick('camera')} /></View>
          <View className="flex-1"><Button kind="secondary" label="From photos" onPress={() => void pick('library')} /></View>
        </View>
      </View>

      <View className="gap-2">
        <Label>Type</Label>
        <View className="flex-row gap-2">
          {(['clothing', 'spice'] as const).map((t) => (
            <Pressable key={t} onPress={() => { setType(t); setCategoryId(null); }} className={`${chip(type === t)} flex-1 items-center`} accessibilityRole="button" accessibilityState={{ selected: type === t }}>
              <Text className={chipText(type === t)}>{t === 'clothing' ? 'Clothing' : 'Spice (stays a draft, D-032)'}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-2">
          {categories.map((c) => (
            <Pressable key={c.id} onPress={() => setCategoryId(c.id)} className={chip(categoryId === c.id)} accessibilityRole="button" accessibilityState={{ selected: categoryId === c.id }}>
              <Text className={chipText(categoryId === c.id)}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Kasavu saree" />
      <Field label="One line for the card" value={f.summary} onChangeText={set('summary')} />
      {type === 'clothing' ? (
        <>
          <Field label="Fabric" value={f.fibre} onChangeText={set('fibre')} placeholder="100% cotton" />
          <Field label="Care" value={f.care} onChangeText={set('care')} placeholder="Hand wash cold" />
        </>
      ) : (
        <>
          <Field label="Ingredients" value={f.ingredients} onChangeText={set('ingredients')} />
          <Field label="Allergens (comma separated)" value={f.allergens} onChangeText={set('allergens')} />
          <Field label="Shelf life (days)" value={f.shelfLife} onChangeText={set('shelfLife')} keyboardType="number-pad" />
        </>
      )}

      <View className="gap-2">
        <Label>Variants and pieces at the shop</Label>
        <VariantRows variants={variants} onChange={setVariants} />
      </View>

      <Field label="Weight of one piece (grams, for the suggested price)" value={f.weight} onChangeText={set('weight')} keyboardType="number-pad" />
      <View className="flex-row gap-3">
        <View className="flex-1"><Field label="Shop price (₹)" value={f.shopPrice} onChangeText={set('shopPrice')} keyboardType="decimal-pad" /></View>
        <View className="flex-1"><Field label="Price (USD), empty = automatic" value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" /></View>
      </View>
      <View className="bg-surface rounded-md p-3">
        <Body muted>
          {suggestion
            ? `${f.price.trim() ? 'Automatic price would be' : 'Price:'} ${formatUsd(suggestion.priceCents)} (goods ${formatUsd(suggestion.goodsCents)}, shipping and duties ${formatUsd(suggestion.logisticsCents)})${data.pricingEstimated ? ', with pilot placeholders' : ''}.`
            : f.shopPrice
              ? 'Every cost in Settings is needed for the automatic price; or type a price.'
              : 'Add the shop price (and a weight) for the automatic price.'}
        </Body>
      </View>

      {problem ? <ErrorText>{problem}</ErrorText> : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      <Button label={action.busy ? 'Saving…' : 'Save draft'} disabled={action.busy} onPress={() => void save()} />
    </View>
  );
}
