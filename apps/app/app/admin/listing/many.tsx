import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { createListing } from '@repo/db/admin';
import { autoPrice, formatUsd, listingSlug } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import { Body, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { ShopPicker, toCents, useListingData, type ListingFormData } from '@/features/admin/listing-form';
import { takePhotos, uploadListingPhotos, type ListingPhoto } from '@/features/admin/listing-photos';
import { AdminButton, Group } from '@/features/admin/ui';
import { supabase } from '@/lib/supabase';

interface Draft {
  key: string;
  photos: ListingPhoto[];
  name: string;
  shopPrice: string;
  pieces: string;
}

const input = 'border-line bg-canvas text-ink font-body min-h-10 rounded-lg border px-2.5 text-[14px]';

function AddMany({ data }: { data: ListingFormData }): React.JSX.Element {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [batch, setBatch] = useState({ fibre: '', care: '' });
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string[]>([]);
  const [suffix] = useState(() => Math.random().toString(36).slice(2, 5));
  const category = data.categories.find((c) => c.id === categoryId);
  const set = (key: string, patch: Partial<Draft>) => setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const photoCount = drafts.reduce((n, d) => n + d.photos.length, 0);

  async function pick(source: 'camera' | 'library'): Promise<void> {
    const result = await takePhotos(source);
    if (result === 'denied') return setReport([`Allow ${source === 'camera' ? 'the camera' : 'photos'} in the phone's settings.`]);
    setDrafts((list) => [...list, ...result.map((p) => ({ key: p.uri, photos: [p], name: '', shopPrice: '', pieces: '1' }))]);
  }

  async function create(): Promise<void> {
    if (!vendorId || !categoryId) return setReport(['Pick the shop and the category for the batch.']);
    if (batch.fibre.trim() === '' || batch.care.trim() === '') return setReport(['Fabric and care are needed (US labelling).']);
    setBusy(true);
    const problems: string[] = [];
    const left: Draft[] = [];
    let made = 0;
    for (const [i, d] of drafts.entries()) {
      try {
        if (d.name.trim().length < 2) throw new Error('needs a name');
        const id = await createListing(supabase, {
          vendor_id: vendorId,
          category_id: categoryId,
          product_type: 'clothing',
          name: d.name.trim(),
          slug: listingSlug(d.name, `${suffix}${i}`),
          shop_price_paise: d.shopPrice ? toCents(d.shopPrice) : undefined,
          attributes: { fibre_content: batch.fibre.trim(), care: batch.care.trim() },
          variants: [{ label: 'One size', options: {}, qty: Math.max(0, Math.round(Number(d.pieces) || 0)) }],
        });
        await uploadListingPhotos(id, d.photos.map((p, n) => ({ ...p, alt: p.alt.trim() || `${d.name.trim()}, photo ${n + 1}` })));
        made += 1;
      } catch (error) {
        problems.push(`Draft ${i + 1}${d.name ? ` (${d.name})` : ''}: ${error instanceof Error && error.message === 'needs a name' ? 'needs a name' : 'not saved; check the shop price'}`);
        left.push(d);
      }
    }
    setBusy(false);
    setDrafts(left);
    setReport([`${made} draft${made === 1 ? '' : 's'} created.`, ...problems]);
    if (left.length === 0 && made > 0) router.replace({ pathname: '/admin/listings', params: { view: 'draft' } });
  }

  const bar = (
    <View className="bg-canvas border-line border-t px-3.5 pb-3 pt-2.5">
      <AdminButton big label={busy ? 'Creating…' : `Create ${drafts.length} draft${drafts.length === 1 ? '' : 's'}`} disabled={busy || drafts.length === 0} onPress={() => void create()} />
    </View>
  );

  return (
    <Screen title="Add many" overlay={bar}>
      <AdminButton big icon="images-outline" label="Pick many photos" onPress={() => void pick('library')} />
      <AdminButton big kind="secondary" icon="camera-outline" label="Take a photo" onPress={() => void pick('camera')} />
      <View className="bg-surface rounded-[10px] px-3 py-2.5">
        <Text className="font-body text-ink text-[12.5px] leading-[18px]">
          {photoCount} photo{photoCount === 1 ? '' : 's'} → {drafts.length} draft{drafts.length === 1 ? '' : 's'}. Each photo starts its own draft; &quot;Join the
          draft above&quot; keeps photos together. Fill what you know now; the rest can wait in Drafts.
        </Text>
      </View>

      <View className="gap-2">
        <Group>For every draft</Group>
        <ShopPicker vendors={data.vendors} value={vendorId} onChange={setVendorId} />
        <View className="flex-row flex-wrap gap-2">
          {data.categories
            .filter((c) => c.product_type === 'clothing' && c.is_active)
            .map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: categoryId === c.id }}
                className={`min-h-10 justify-center rounded-pill border px-3.5 ${categoryId === c.id ? 'border-ink bg-ink' : 'border-line bg-paper'}`}
              >
                <Text className={`font-ui text-[14px] ${categoryId === c.id ? 'text-paper' : 'text-ink'}`}>{c.name}</Text>
              </Pressable>
            ))}
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Field label="Fabric" value={batch.fibre} onChangeText={(t) => setBatch((b) => ({ ...b, fibre: t }))} placeholder="100% cotton" />
          </View>
          <View className="flex-1">
            <Field label="Care" value={batch.care} onChangeText={(t) => setBatch((b) => ({ ...b, care: t }))} placeholder="Hand wash" />
          </View>
        </View>
      </View>

      {report.map((line) => (
        <Body key={line}>{line}</Body>
      ))}

      {drafts.map((d, i) => {
        const cents = d.shopPrice && category?.default_weight_g ? autoPrice({ shopPricePaise: toCents(d.shopPrice), weightG: category.default_weight_g }, data.pricing)?.priceCents : null;
        return (
          <View key={d.key} className="border-line bg-paper flex-row gap-3 rounded-[14px] border p-3">
            <View className="w-[60px]">
              <View className="flex-row">
                {d.photos.map((p, n) => (
                  <View key={p.uri} className={`border-paper bg-land h-12 w-9 overflow-hidden rounded-[7px] border-2 ${n ? '-ml-5' : ''}`}>
                    <Image source={p.uri} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  </View>
                ))}
              </View>
              {i > 0 ? (
                <Pressable
                  onPress={() => setDrafts((list) => list.map((x, j) => (j === i - 1 ? { ...x, photos: [...x.photos, ...d.photos] } : x)).filter((x) => x.key !== d.key))}
                  accessibilityRole="button"
                  className="mt-1 min-h-8"
                >
                  <Text className="font-ui text-ink-muted text-[11.5px] underline">Join the draft above</Text>
                </Pressable>
              ) : null}
            </View>
            <View className="min-w-0 flex-1 gap-1.5">
              <TextInput value={d.name} onChangeText={(t) => set(d.key, { name: t })} placeholder="Name" placeholderTextColor={tokens.colors['ink-muted']} accessibilityLabel={`Name, draft ${i + 1}`} className={input} />
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={d.shopPrice}
                  onChangeText={(t) => set(d.key, { shopPrice: t })}
                  placeholder="₹ shop price"
                  placeholderTextColor={tokens.colors['ink-muted']}
                  keyboardType="decimal-pad"
                  accessibilityLabel={`Shop price in rupees, draft ${i + 1}`}
                  className={`${input} flex-1`}
                />
                <Text className="font-ui-semibold text-positive w-[70px] text-right text-[14px]">{cents ? formatUsd(cents) : '—'}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="font-ui text-ink-muted text-[13px]">Pieces</Text>
                <TextInput
                  value={d.pieces}
                  onChangeText={(t) => set(d.key, { pieces: t })}
                  keyboardType="number-pad"
                  accessibilityLabel={`Pieces, draft ${i + 1}`}
                  className={`${input} w-16 text-right`}
                />
              </View>
            </View>
          </View>
        );
      })}
      <View className="h-20" />
    </Screen>
  );
}

/** Add many (D-097): a batch of photos becomes drafts, one card each. Clothing (spices can't go live yet, D-032). */
export default function AddManyScreen(): React.JSX.Element {
  const { data, error, loading } = useListingData();
  if (data) return <AddMany data={data} />;
  return (
    <Screen title="Add many">
      {error ? <ErrorText>{error}</ErrorText> : null}
      {loading ? <Loading /> : null}
    </Screen>
  );
}
