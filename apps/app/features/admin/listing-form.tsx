import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  createListing,
  getPricingSettings,
  listCategories,
  listPricingEstimates,
  listVendors,
  PRICE_SUGGESTION_SETTINGS,
  setProductStatus,
} from '@repo/db/admin';
import { autoPrice, formatUsd, listingInputSchema, listingSlug, pricingSettingsFrom, variantLabel, type PricingSettings } from '@repo/shared/domain';

import { takePhotos, uploadListingPhotos, type ListingPhoto } from './listing-photos';
import { PhotoTiles } from './photo-tiles';
import { AdminButton, Chip, Group } from './ui';
import { useAction } from './use-action';
import { EMPTY_VARIANT, VariantRows, type VariantDraft } from './variant-rows';

import { Body, ErrorText, Field, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useQuery, type QueryState } from '@/lib/use-query';

export interface ListingFormData {
  vendors: { id: string; shop_name: string; town?: string | null; region: { name: string; slug?: string } | null }[];
  categories: { id: string; product_type: 'clothing' | 'spice'; name: string; is_active: boolean; default_weight_g: number | null }[];
  pricing: PricingSettings;
  /** Some of those settings are still Claude's researched estimates (D-047). */
  pricingEstimated: boolean;
}

/** The shops, categories and price settings a new listing needs (New listing and Add many). */
export function useListingData(): QueryState<ListingFormData> {
  return useQuery('admin:new-listing', async () => {
    const [vendors, categories, pricing, estimates] = await Promise.all([
      listVendors(supabase, { status: 'active' }),
      listCategories(supabase),
      getPricingSettings(supabase),
      listPricingEstimates(supabase),
    ]);
    return {
      vendors,
      categories,
      pricing: pricingSettingsFrom(pricing as unknown as Record<string, unknown>),
      pricingEstimated: estimates.some((e) => PRICE_SUGGESTION_SETTINGS.includes(e.setting)),
    };
  });
}

const chip = (on: boolean): string => `min-h-10 justify-center rounded-pill border px-3.5 ${on ? 'border-ink bg-ink' : 'border-line bg-paper'}`;
const chipText = (on: boolean): string => `font-ui text-[14px] ${on ? 'text-paper' : 'text-ink'}`;
export const toCents = (v: string): number => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100);
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

/** The shop, found by typing (there are many): the chosen one as a chip, tap it to change. */
export function ShopPicker({ vendors, value, onChange }: { vendors: ListingFormData['vendors']; value: string | null; onChange: (id: string | null) => void }): React.JSX.Element {
  const [query, setQuery] = useState('');
  const vendor = vendors.find((v) => v.id === value);
  const q = query.trim().toLowerCase();
  const shops = q ? vendors.filter((v) => `${v.shop_name} ${v.town ?? ''} ${v.region?.name ?? ''}`.toLowerCase().includes(q)).slice(0, 6) : [];
  if (vendor)
    return (
      <Pressable onPress={() => onChange(null)} className={`${chip(true)} self-start`} accessibilityRole="button" accessibilityHint="Change the shop">
        <Text className={chipText(true)}>
          {vendor.shop_name} · {vendor.region?.name} ✕
        </Text>
      </Pressable>
    );
  return (
    <View className="gap-1.5">
      <Field label="Shop" value={query} onChangeText={setQuery} placeholder="Shop name, town or state" />
      {shops.map((v) => (
        <Pressable key={v.id} onPress={() => onChange(v.id)} className="border-line bg-paper min-h-11 justify-center rounded-md border px-3">
          <Text className="font-body text-ink">
            {v.shop_name} · {[v.town, v.region?.name].filter(Boolean).join(', ')}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * A new listing from a phone at the shop (D-097, flows.md §2): Take photos or many from the gallery first, then the
 * shop, type, category, name (the web address follows), the type's details, options with pieces, and the shop price
 * with the dollar price shown live (D-075, the database's own formula). Save draft or Publish, fixed at the bottom.
 * Saved in one database transaction; the photos go up after it, and any that fail can be sent again.
 */
export function ListingForm({ data, onDone }: { data: ListingFormData; onDone: () => void }): React.JSX.Element {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [type, setType] = useState<'clothing' | 'spice'>('clothing');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', summary: '', fibre: '', care: '', ingredients: '', allergens: '', shelfLife: '', weight: '', shopPrice: '', price: '' });
  const [variants, setVariants] = useState<VariantDraft[]>([EMPTY_VARIANT]);
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; failed: ListingPhoto[] } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [suffix] = useState(() => Math.random().toString(36).slice(2, 6));
  const action = useAction();
  const set = (key: keyof typeof f) => (text: string) => setF((v) => ({ ...v, [key]: text }));

  const vendor = data.vendors.find((v) => v.id === vendorId);
  const categories = data.categories.filter((c) => c.product_type === type && c.is_active);
  const weight = Number(f.weight) || null;
  // D-075: the price follows from the shop price and the weight (else the category's typical weight), as the database
  // will set it. A typed price overrides it.
  const category = data.categories.find((c) => c.id === categoryId);
  const autoWeight = weight ?? category?.default_weight_g ?? null;
  const suggestion = f.shopPrice && autoWeight ? autoPrice({ shopPricePaise: toCents(f.shopPrice), weightG: Math.round(autoWeight) }, data.pricing) : null;
  const slug = listingSlug(f.name || 'new listing', suffix);

  async function pick(source: 'camera' | 'library'): Promise<void> {
    const result = await takePhotos(source);
    if (result === 'denied') setProblem(`Allow ${source === 'camera' ? 'the camera' : 'photos'} in the phone's settings.`);
    else setPhotos((p) => [...p, ...result]);
  }

  async function save(publish: boolean): Promise<void> {
    setProblem(null);
    if (variants.length === 0) return setProblem('Add at least one option.');
    const listing = {
      vendor_id: vendorId ?? '',
      category_id: categoryId ?? '',
      product_type: type,
      name: f.name.trim(),
      slug,
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
      const failed = await uploadListingPhotos(id, named, 0, setUploading);
      setUploading(null);
      // Published only with every photo up and a photo at all; otherwise it waits in Drafts.
      if (publish && failed.length === 0 && named.length > 0) await setProductStatus(supabase, id, 'live');
      setSaved({ id, failed });
      if (failed.length === 0) onDone();
    });
  }

  if (saved && saved.failed.length > 0) {
    return (
      <Screen title="New listing">
        <Body>Saved as a draft. {saved.failed.length} photo(s) didn&apos;t upload.</Body>
        <AdminButton
          big
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
        <AdminButton big kind="secondary" label="Leave them for later" onPress={onDone} />
      </Screen>
    );
  }

  const bar = (
    <View className="bg-canvas border-line flex-row gap-2 border-t px-3.5 pb-3 pt-2.5">
      <View className="flex-1">
        <AdminButton big kind="secondary" label="Save draft" disabled={action.busy} onPress={() => void save(false)} />
      </View>
      <View className="flex-1">
        <AdminButton
          big
          label={uploading !== null ? `Photo ${uploading + 1} of ${photos.length}…` : action.busy ? 'Saving…' : 'Publish'}
          disabled={action.busy || type === 'spice'}
          onPress={() => void save(true)}
        />
      </View>
    </View>
  );

  return (
    <Screen title="New listing" overlay={bar}>
      <View className="border-ink-muted gap-2 rounded-[14px] border-2 border-dashed p-3">
        <AdminButton big icon="camera-outline" label="Take photos" onPress={() => void pick('camera')} />
        <AdminButton big kind="secondary" icon="images-outline" label="Choose from gallery (many)" onPress={() => void pick('library')} />
      </View>
      <PhotoTiles photos={photos} onChange={setPhotos} />

      <View className="gap-2">
        <Group>Shop</Group>
        <ShopPicker vendors={data.vendors} value={vendorId} onChange={setVendorId} />
      </View>

      <View className="gap-2">
        <Group>Type</Group>
        <View className="border-line bg-canvas flex-row rounded-[10px] border p-[3px]">
          {(['clothing', 'spice'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setType(t);
                setCategoryId(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
              className={`min-h-10 flex-1 items-center justify-center rounded-lg ${type === t ? 'bg-ink' : ''}`}
            >
              <Text className={`font-ui-semibold text-[13px] ${type === t ? 'text-paper' : 'text-ink-muted'}`}>{t === 'clothing' ? 'Clothing' : 'Spice'}</Text>
            </Pressable>
          ))}
        </View>
        {type === 'spice' ? <Body muted>Spices can be saved as drafts; they can&apos;t go live yet (D-032).</Body> : null}
        <View className="flex-row flex-wrap gap-2">
          {categories.map((c) => (
            <Pressable key={c.id} onPress={() => setCategoryId(c.id)} className={chip(categoryId === c.id)} accessibilityRole="button" accessibilityState={{ selected: categoryId === c.id }}>
              <Text className={chipText(categoryId === c.id)}>{c.name}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Kasavu saree" />
        <Text className="font-body text-ink-muted text-[12.5px]">
          Web address: /states/{vendor?.region?.slug ?? '…'}/{slug}
        </Text>
      </View>
      <Field label="One line for the card" value={f.summary} onChangeText={set('summary')} />
      {type === 'clothing' ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Fabric" value={f.fibre} onChangeText={set('fibre')} placeholder="100% cotton" />
          </View>
          <View className="flex-1">
            <Field label="Care" value={f.care} onChangeText={set('care')} placeholder="Hand wash cold" />
          </View>
        </View>
      ) : (
        <>
          <Field label="Ingredients" value={f.ingredients} onChangeText={set('ingredients')} />
          <Field label="Allergens (comma separated)" value={f.allergens} onChangeText={set('allergens')} />
          <Field label="Shelf life (days)" value={f.shelfLife} onChangeText={set('shelfLife')} keyboardType="number-pad" />
        </>
      )}

      <View className="gap-2">
        <Group>Sizes / colours and pieces</Group>
        <VariantRows variants={variants} onChange={setVariants} />
      </View>

      <Field
        label="Weight of one piece (grams)"
        value={f.weight}
        onChangeText={set('weight')}
        keyboardType="number-pad"
        placeholder={category?.default_weight_g ? `${category.default_weight_g} (usual for the category)` : ''}
      />
      <View className="flex-row items-end gap-2.5">
        <View className="flex-1">
          <Field label="Shop price ₹" value={f.shopPrice} onChangeText={set('shopPrice')} keyboardType="decimal-pad" placeholder="6,200" />
        </View>
        <Text className="font-ui-semibold text-ink-muted pb-3.5 text-[18px]">→</Text>
        <View className="flex-1 rounded-[10px] border border-[rgba(22,101,52,0.2)] bg-[rgba(22,101,52,0.08)] px-3 py-2" accessibilityLiveRegion="polite">
          <Text className="font-ui text-ink-muted text-[11.5px]">Sells for</Text>
          <Text className="font-ui-semibold text-positive text-[22px]">
            {f.price.trim() ? formatUsd(toCents(f.price)) : suggestion ? formatUsd(suggestion.priceCents) : '—'}
          </Text>
        </View>
      </View>
      <Field label="Price $ by hand (empty = automatic)" value={f.price} onChangeText={set('price')} keyboardType="decimal-pad" />
      {suggestion && data.pricingEstimated ? <Chip tone="warn">Some costs in Settings are still pilot estimates</Chip> : null}
      {!suggestion && f.shopPrice ? <Body muted>Every cost in Settings is needed for the automatic price; or type a price.</Body> : null}

      {problem ? <ErrorText>{problem}</ErrorText> : null}
      {action.error ? <ErrorText>{action.error}</ErrorText> : null}
      <View className="h-20" />
    </Screen>
  );
}
