'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { listingSlug, variantLabel, type PricingSettings } from '@repo/shared/domain';

import { saveListingAction } from '../actions/listings';
import { button, input, panel, secondaryButton } from '../styles';

import { newOption, OptionsTable, type Option } from './options-table';
import { DropZone, PhotoGrid, usePhotoUploads } from './photo-grid';
import { livePrice, SellsFor, toPaise } from './sells-for';

export interface ListingFormData {
  vendors: { id: string; shop_name: string; town: string | null; region: { name: string; slug: string } | null }[];
  categories: { id: string; product_type: 'clothing' | 'spice'; name: string; is_active: boolean; default_weight_g: number | null }[];
  pricing: PricingSettings;
}

const label = 'font-ui text-ink-muted block text-[12px] font-semibold leading-tight';
const seg = (on: boolean): string =>
  `grid h-11 cursor-pointer place-items-center rounded-lg text-[13px] font-semibold md:h-[34px] ${on ? 'bg-ink text-paper' : 'text-ink-muted'}`;

/**
 * New listing in one step (D-096): shop, type, category, name (the web address follows from it), the type's
 * details, the options with pieces and weight, the shop price with the dollar price shown live (D-075), and the
 * photos beside it, uploading as they are dropped. Save draft or Publish; nothing waits for a second page.
 */
export function NewListing({ data }: { data: ListingFormData }): React.JSX.Element {
  const router = useRouter();
  const { photos, setPhotos, add } = usePhotoUploads();
  // A short random tail keeps two listings with one name apart; drawn in the browser only, so the page hydrates cleanly.
  const [suffix, setSuffix] = useState('');
  useEffect(() => setSuffix(Math.random().toString(36).slice(2, 6)), []);
  const [type, setType] = useState<'clothing' | 'spice'>('clothing');
  const [vendorId, setVendorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [f, setF] = useState({ name: '', summary: '', fibre: '', care: '', ingredients: '', allergens: '', shelfLife: '', shopPrice: '', price: '' });
  const [slug, setSlug] = useState<string | null>(null);
  const [byHand, setByHand] = useState(false);
  const [options, setOptions] = useState<Option[]>([newOption()]);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [key]: e.target.value }));

  const vendor = data.vendors.find((v) => v.id === vendorId);
  const categories = data.categories.filter((c) => c.product_type === type && c.is_active);
  const category = data.categories.find((c) => c.id === categoryId);
  const autoSlug = listingSlug(f.name || 'new listing', suffix);
  const webSlug = slug ?? autoSlug;
  const weights = options.map((o) => Number(o.weight)).filter((w) => w > 0);
  const weight = weights.length ? Math.max(...weights) : (category?.default_weight_g ?? null);
  const cents = livePrice(toPaise(f.shopPrice), weight, data.pricing);

  const save = (publish: boolean): void => {
    setProblem(null);
    if (photos.some((p) => !p.path && !p.error)) return setProblem('Wait for the photos to finish uploading.');
    const listing = {
      vendor_id: vendorId,
      category_id: categoryId,
      product_type: type,
      name: f.name.trim(),
      slug: webSlug,
      summary: f.summary.trim() || undefined,
      price_cents: byHand && f.price.trim() ? Math.round(Number(f.price) * 100) : undefined,
      shop_price_paise: toPaise(f.shopPrice) ?? undefined,
      attributes:
        type === 'clothing'
          ? { fibre_content: f.fibre.trim(), care: f.care.trim() }
          : {
              ingredients: f.ingredients.trim(),
              allergens: f.allergens.split(',').map((a) => a.trim()).filter(Boolean),
              shelf_life_days: Number(f.shelfLife),
            },
      variants: options.map((o) => ({
        label: variantLabel({ colour: o.colour, size: o.size }),
        options: { ...(o.colour.trim() ? { colour: o.colour.trim() } : {}), ...(o.size.trim() ? { size: o.size.trim() } : {}) },
        qty: Math.max(0, Math.round(Number(o.qty) || 0)),
        ...(Number(o.weight) > 0 ? { weight_g: Math.round(Number(o.weight)) } : {}),
      })),
    };
    if (!vendorId) return setProblem('Pick the shop.');
    if (!categoryId) return setProblem('Pick a category.');
    if (listing.name.length < 2) return setProblem('Give the piece a name.');
    const pics = photos.filter((p) => p.path).map((p, i) => ({ path: p.path!, alt: p.alt.trim() || `${listing.name}, photo ${i + 1}` }));
    start(async () => {
      const result = await saveListingAction(listing, pics, publish);
      if ('error' in result) return setProblem(result.error);
      router.push(`/admin/catalog/${result.id}${result.note ? `?note=${encodeURIComponent(result.note)}` : ''}`);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      aria-label="New listing"
    >
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-2">
        <div className={`${panel} order-2 grid gap-3 lg:order-1`}>
          <label className="block space-y-[5px]">
            <span className={label}>Shop</span>
            <select name="vendorId" required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={input}>
              <option value="" disabled>
                Choose…
              </option>
              {data.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shop_name} · {[v.town, v.region?.name].filter(Boolean).join(', ')}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-[5px]">
            <legend className={label}>Type</legend>
            <div className="border-line bg-canvas mt-[5px] grid grid-cols-2 rounded-[10px] border p-[3px]">
              {(['clothing', 'spice'] as const).map((t) => (
                <label key={t} className={seg(type === t)}>
                  <input
                    type="radio"
                    name="productType"
                    value={t}
                    checked={type === t}
                    onChange={() => {
                      setType(t);
                      setCategoryId('');
                    }}
                    className="sr-only"
                  />
                  {t === 'clothing' ? 'Clothing' : 'Spice'}
                </label>
              ))}
            </div>
            {type === 'spice' ? <small className="text-ink-muted text-[12px]">Spices can be saved as drafts; they can&apos;t go live yet (D-032).</small> : null}
          </fieldset>
          <label className="block space-y-[5px]">
            <span className={label}>Category</span>
            <select name="categoryId" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={input}>
              <option value="" disabled>
                Choose…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-[5px]">
            <span className={label}>Name</span>
            <input name="name" required value={f.name} onChange={set('name')} className={input} />
          </label>
          <p className="text-ink-muted -mt-1 text-[12.5px] leading-[1.3]">
            {slug === null ? (
              <>
                Web address: <b className="text-ink font-medium">/states/{vendor?.region?.slug ?? '…'}/{autoSlug}</b> (from the name) ·{' '}
                <button type="button" onClick={() => setSlug(autoSlug)} className="text-ink underline">
                  Edit
                </button>
              </>
            ) : (
              <label className="block space-y-[5px]">
                <span className={label}>Web address (lowercase letters, digits and dashes)</span>
                <input name="slug" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={input} />
              </label>
            )}
          </p>
          <label className="block space-y-[5px]">
            <span className={label}>Summary</span>
            <input name="summary" value={f.summary} onChange={set('summary')} placeholder="One line for the product card" className={input} />
          </label>
          {type === 'clothing' ? (
            <div className="grid grid-cols-2 gap-2.5">
              <label className="block space-y-[5px]">
                <span className={label}>Fabric</span>
                <input name="fibre" value={f.fibre} onChange={set('fibre')} placeholder="100% cotton" className={input} />
              </label>
              <label className="block space-y-[5px]">
                <span className={label}>Care</span>
                <input name="care" value={f.care} onChange={set('care')} placeholder="Hand wash, dry in shade" className={input} />
              </label>
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="block space-y-[5px]">
                <span className={label}>Ingredients</span>
                <input name="ingredients" value={f.ingredients} onChange={set('ingredients')} className={input} />
              </label>
              <label className="block space-y-[5px]">
                <span className={label}>Allergens (comma separated)</span>
                <input name="allergens" value={f.allergens} onChange={set('allergens')} className={input} />
              </label>
              <label className="block space-y-[5px]">
                <span className={label}>Shelf life (days)</span>
                <input name="shelfLifeDays" type="number" min="1" value={f.shelfLife} onChange={set('shelfLife')} className={input} />
              </label>
            </div>
          )}

          <OptionsTable options={options} setOptions={setOptions} defaultWeight={category?.default_weight_g ?? null} />

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
            <label className="block space-y-[5px]">
              <span className={label}>Shop price ₹</span>
              <input name="shopPrice" inputMode="decimal" value={f.shopPrice} onChange={set('shopPrice')} placeholder="6,200" className={input} />
            </label>
            <span className="text-ink-muted pb-3 text-[18px] font-semibold">→</span>
            {byHand ? (
              <label className="block space-y-[5px]">
                <span className={label}>
                  Price $ by hand ·{' '}
                  <button type="button" onClick={() => setByHand(false)} className="text-ink underline">
                    automatic
                  </button>
                </span>
                <input name="price" type="number" step="0.01" min="0.01" value={f.price} onChange={set('price')} className={input} />
              </label>
            ) : (
              <SellsFor
                cents={cents}
                why={
                  <>
                    {cents === null ? 'from the shop price, weight and Settings (D-075)' : 'from the shop price, weight and Settings'} ·{' '}
                    <button type="button" onClick={() => setByHand(true)} className="text-ink underline">
                      set by hand
                    </button>
                  </>
                }
              />
            )}
          </div>
        </div>

        <div className={`${panel} order-1 lg:order-2`}>
          <h2 className="font-heading mb-3 flex items-center gap-2 text-[15px] font-semibold">
            Photos
            <small className="font-ui text-ink-muted ml-auto text-[12px] font-medium">first is the main photo · drag to reorder</small>
          </h2>
          <DropZone onFiles={(files) => add(files)} />
          <PhotoGrid photos={photos} setPhotos={setPhotos} />
          <p className="text-ink-muted mt-2.5 text-[12.5px]">
            Alt text under each photo says what it shows, for screen readers. Left empty, it becomes the name and the photo&apos;s number.
          </p>
        </div>
      </div>
      {problem ? (
        <p role="alert" className="text-danger mt-3 text-[14px]">
          {problem}
        </p>
      ) : null}
      <div className="border-line bg-canvas sticky bottom-0 z-20 -mx-3.5 mt-4 flex justify-end gap-2 border-t px-3.5 py-3 md:static md:mx-0 md:border-0 md:p-0 [&>button]:flex-1 md:[&>button]:flex-none">
        <button type="submit" disabled={pending} className={secondaryButton}>
          Save draft
        </button>
        <button type="button" disabled={pending} onClick={() => save(true)} className={button}>
          {pending ? 'Saving…' : 'Publish'}
        </button>
      </div>
    </form>
  );
}
