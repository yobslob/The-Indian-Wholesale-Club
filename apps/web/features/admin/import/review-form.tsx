'use client';

import { useEffect, useState, useTransition } from 'react';

import {
  fallbackWeightG,
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPES,
  WEARS,
  WEARS_LABEL,
  wearsFromHints,
  wearsFromName,
  type PricingSettings,
  type ProductType,
  type Wears,
} from '@repo/shared/domain';
import {
  cleanTitle,
  guessCategory,
  guessDetails,
  guessProductType,
  guessRegionSlug,
  shorten,
  siteLabel,
  type SourcedProduct,
} from '@repo/shared/sourcing';

import { livePrice, SellsFor, toPaise } from '../listing/sells-for';
import { button, input, panel, secondaryButton } from '../styles';

import {
  findImportedAction,
  saveImportAction,
  type ExistingListing,
  type ImportResult,
} from './actions';

export interface ImportFormData {
  regions: { id: string; slug: string; name: string }[];
  categories: {
    id: string;
    slug: string;
    name: string;
    product_type: ProductType;
    is_active: boolean;
    default_weight_g: number | null;
  }[];
  pricing: PricingSettings;
}

const label = 'font-ui text-ink-muted block text-[12px] font-semibold leading-tight';
const seg = (on: boolean): string =>
  `grid h-11 cursor-pointer place-items-center rounded-lg text-[13px] font-semibold md:h-[34px] ${on ? 'bg-ink text-paper' : 'text-ink-muted'}`;
const inr = (paise: number): string =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function firstSentence(text: string): string {
  return (
    text
      .split('\n')
      .map((l) => l.replace(/^•\s*/, '').trim())
      .find((l) => l.length > 20)
      ?.split(/(?<=\.)\s/)[0] ?? ''
  );
}

/**
 * One imported product to check before it is saved (D-110): the shop's photos (pick and order), its name and words,
 * the state it comes from, the type and category, the details customers must see, the shop's price with our price
 * worked out live (D-109), and the sizes. Nothing is guessed silently: every guess is a pre-filled field.
 */

/** The state picker's "All states": the listing gets no state (D-121). */
const ALL = 'all';

export function ReviewForm({
  product,
  data,
  onDone,
}: {
  product: SourcedProduct;
  data: ImportFormData;
  onDone: (result: ImportResult & { name: string }) => void;
}): React.JSX.Element {
  const active = data.categories.filter((c) => c.is_active);
  const [type, setType] = useState<ProductType>(() => guessProductType(product));
  const [regionId, setRegionId] = useState(
    () => data.regions.find((r) => r.slug === guessRegionSlug(product))?.id ?? '',
  );
  const [categoryId, setCategoryId] = useState(() => guessCategory(product, type, active) ?? '');
  // D-140: who it is for, from the shop's own field (Myntra's gender), else the name; chosen by the admin otherwise
  const [wears, setWears] = useState<Wears | ''>(() => wearsFromHints(product.hints) ?? wearsFromName(product.title) ?? '');
  const [f, setF] = useState(() => {
    const d = guessDetails(product);
    const bullets = product.bullets.map((b) => `• ${b}`).join('\n');
    return {
      // D-140 (L1): IWC's name, without the brand or shop; the shop's full title is kept for the admin
      name: shorten(cleanTitle(product.title, { brand: product.brand, productType: guessProductType(product) }), 120),
      summary: shorten(product.bullets[0] ?? firstSentence(product.description), 300),
      description: [bullets, product.description].filter(Boolean).join('\n\n').slice(0, 4000),
      fibre: d.fibre,
      care: d.care,
      material: d.material,
      ingredients: d.ingredients,
      allergens: d.allergens,
      shelfLife: d.shelfLifeDays ? String(d.shelfLifeDays) : '',
      weight: d.weightG ? String(d.weightG) : '',
      shopPrice: product.pricePaise ? String(product.pricePaise / 100) : '',
      qty: '5',
    };
  });
  // D-129: what the page itself says the piece weighs, kept to tell the shop's weight from a typed one
  const [pageWeight] = useState(() => {
    const d = guessDetails(product);
    return { grams: d.weightG, note: d.weightNote, differs: d.weightDiffers };
  });
  const [photos, setPhotos] = useState<string[]>(() => product.images.slice(0, 10));
  const [existing, setExisting] = useState<ExistingListing | null | undefined>(undefined);
  const [replace, setReplace] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    findImportedAction(product.url).then(setExisting, () => setExisting(null));
  }, [product.url]);
  const set =
    (key: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((v) => ({ ...v, [key]: e.target.value }));

  const priced = product.variants.filter((v) => v.pricePaise);
  const category = data.categories.find((c) => c.id === categoryId);
  const weight =
    Number(f.weight) > 0
      ? Number(f.weight)
      : fallbackWeightG(type, toPaise(f.shopPrice), category?.default_weight_g ?? null, data.pricing);
  const cents = livePrice(toPaise(f.shopPrice), weight, data.pricing, type);
  const toggle = (url: string): void =>
    setPhotos((list) =>
      list.includes(url) ? list.filter((u) => u !== url) : [...list, url].slice(0, 12),
    );

  const save = (publish: boolean): void => {
    setProblem(null);
    if (!regionId) return setProblem('Pick the state it comes from, or All states.');
    if (!categoryId) return setProblem('Pick a category.');
    if (type === 'clothing' && !wears) return setProblem('Choose who it is for.');
    if (!existing && photos.length === 0) return setProblem('Pick at least one photo.');
    const attributes =
      type === 'clothing'
        ? { fibre_content: f.fibre.trim(), care: f.care.trim() }
        : type === 'home'
          ? { material: f.material.trim() }
          : {
              ingredients: f.ingredients.trim(),
              allergens: f.allergens
                .split(',')
                .map((a) => a.trim())
                .filter(Boolean),
              shelf_life_days: Number(f.shelfLife) || 0,
            };
    start(async () => {
      const result = await saveImportAction({
        product,
        // D-121: "All states" = no state tag; the piece shows on every state's page
        regionId: regionId === ALL ? null : regionId,
        categoryId,
        productType: type,
        wears: type === 'clothing' && wears ? wears : null,
        name: f.name.trim(),
        summary: f.summary.trim(),
        description: f.description.trim(),
        attributes,
        photos,
        qtyPerSize: Math.max(0, Math.min(99, Math.round(Number(f.qty) || 0))),
        weightG: Number(f.weight) > 0 ? Math.round(Number(f.weight)) : null,
        weightNote: Math.round(Number(f.weight)) === pageWeight.grams ? pageWeight.note : null,
        shopPricePaise: toPaise(f.shopPrice) ?? 0,
        publish,
        replaceDetails: replace,
      });
      if ('error' in result) return setProblem(result.error);
      onDone({ ...result, name: f.name.trim() });
    });
  };

  const field = (
    key: keyof typeof f,
    text: string,
    extra: React.InputHTMLAttributes<HTMLInputElement> = {},
  ): React.JSX.Element => (
    <label className="block space-y-[5px]">
      <span className={label}>{text}</span>
      <input value={f[key]} onChange={set(key)} className={input} {...extra} />
    </label>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      aria-label={`Import ${product.title}`}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-[18px] lg:grid-cols-2"
    >
      <div className={`${panel} space-y-3`}>
        <p className="text-[13px] leading-[1.4]">
          <b>{siteLabel(product.site)}</b>
          {product.brand ? ` · ${product.brand}` : ''} ·{' '}
          <a href={product.url} target="_blank" rel="noreferrer" className="underline">
            open the page
          </a>
        </p>
        {existing ? (
          <div className="border-line bg-canvas rounded-[10px] border px-3 py-2.5 text-[13px] leading-[1.4]">
            Already listed as{' '}
            <a href={`/admin/catalog/${existing.id}`} className="font-semibold underline">
              {existing.name}
            </a>{' '}
            ({existing.status}
            {existing.region ? `, ${existing.region}` : ''}
            {existing.shopPricePaise ? `, ${inr(existing.shopPricePaise)} before` : ''}). Saving
            updates its price and sizes.
            <label className="mt-1.5 flex items-center gap-2">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{' '}
              Also replace its name, words and photos
            </label>
          </div>
        ) : null}
        {product.inStock === false ? (
          <p className="text-danger text-[13px]">The shop shows this as out of stock.</p>
        ) : null}
        <h2 className="font-heading text-[15px] font-semibold">
          Photos{' '}
          <small className="font-ui text-ink-muted text-[12px] font-medium">
            · tap to leave one out · numbered in order, 1 is the main photo
          </small>
        </h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {product.images.map((url) => {
            const n = photos.indexOf(url);
            return (
              <li key={url}>
                <button
                  type="button"
                  onClick={() => toggle(url)}
                  aria-pressed={n >= 0}
                  className={`relative block aspect-[3/4] w-full overflow-hidden rounded-lg border-2 ${n >= 0 ? 'border-ink' : 'border-transparent opacity-40'}`}
                >
                  {/* The shop's own photo, shown from its address until it is copied on save (next.config.js allows it here only). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {n >= 0 ? (
                    <span className="bg-ink text-paper absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold">
                      {n + 1}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className={`${panel} grid gap-3`}>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block space-y-[5px]">
            <span className={label}>State it comes from</span>
            <select
              required
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className={input}
            >
              <option value="" disabled>
                Choose…
              </option>
              <option value={ALL}>All states (no state shown)</option>
              {data.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-[5px]">
            <span className={label}>Category</span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={input}
            >
              <option value="" disabled>
                Choose…
              </option>
              {active
                .filter((c) => c.product_type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend className={label}>Type</legend>
          <div className="border-line bg-canvas mt-[5px] grid grid-cols-3 rounded-[10px] border p-[3px]">
            {PRODUCT_TYPES.map((t) => (
              <label key={t} className={seg(type === t)}>
                <input
                  type="radio"
                  name="productType"
                  value={t}
                  checked={type === t}
                  onChange={() => {
                    setType(t);
                    setCategoryId(guessCategory(product, t, active) ?? '');
                  }}
                  className="sr-only"
                />
                {PRODUCT_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>
        {type === 'clothing' ? (
          <fieldset>
            <legend className={label}>For</legend>
            <div className="border-line bg-canvas mt-[5px] grid grid-cols-2 rounded-[10px] border p-[3px] sm:grid-cols-4">
              {WEARS.map((w) => (
                <label key={w} className={seg(wears === w)}>
                  <input type="radio" name="wears" value={w} checked={wears === w} onChange={() => setWears(w)} className="sr-only" />
                  {WEARS_LABEL[w]}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {field('name', 'Name', { required: true, maxLength: 120 })}
        {field('summary', 'Summary (one line)', { maxLength: 300 })}
        <label className="block space-y-[5px]">
          <span className={label}>Description</span>
          <textarea
            value={f.description}
            onChange={set('description')}
            rows={6}
            maxLength={4000}
            className={`${input} h-auto py-2 leading-[1.4]`}
          />
        </label>
        {type === 'clothing' ? (
          <div className="grid grid-cols-2 gap-2.5">
            {field('fibre', 'Fabric', { placeholder: 'Silk blend' })}
            {field('care', 'Care', { placeholder: 'Dry clean' })}
          </div>
        ) : type === 'home' ? (
          field('material', 'Material', { placeholder: 'Brass' })
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-3">
            {field('ingredients', 'Ingredients')}
            {field('allergens', 'Allergens (comma separated)')}
            {field('shelfLife', 'Shelf life (days)', { type: 'number', min: 1 })}
          </div>
        )}
        <p className="text-ink-muted text-[12.5px] leading-[1.35]">
          {priced.length > 1
            ? `Variants, each priced from its own shop price (D-118): ${priced
                .map(
                  (v) =>
                    `${v.label} ${inr(v.pricePaise!)}${v.inStock === false ? ' (sold out)' : ''}`,
                )
                .join(', ')}`
            : `Sizes: ${
                product.sizes.length
                  ? product.sizes
                      .map((s) => (s.available ? s.label : `${s.label} (sold out)`))
                      .join(', ')
                  : 'one size'
              }`}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {field('qty', 'Pieces offered per size', { type: 'number', min: 0, max: 99 })}
          {field('weight', 'Packed weight, g', { type: 'number', min: 1 })}
        </div>
        <p className="text-ink-muted text-[13px]">
          {Number(f.weight) > 0 && Math.round(Number(f.weight)) === pageWeight.grams
            ? `From the page: ${pageWeight.note}`
            : Number(f.weight) > 0
              ? 'Typed by you.'
              : `No weight on the page: weigh it packed or type the shop's. Until it has one it is priced on ${category?.default_weight_g ? `about ${category.default_weight_g} g` : 'an estimate'} and stays a draft (D-129).`}
          {pageWeight.differs ? (
            <span className="text-caution block">The page also says {pageWeight.differs}: check which is right.</span>
          ) : null}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2.5">
          {field(
            'shopPrice',
            `Price on ${siteLabel(product.site)} ₹${product.mrpPaise && product.mrpPaise !== product.pricePaise ? ` (MRP ${inr(product.mrpPaise)})` : ''}`,
            { inputMode: 'decimal', required: true },
          )}
          <span className="text-ink-muted pb-3 text-[18px] font-semibold">→</span>
          <SellsFor cents={cents} why="from the shop's price, weight and Settings (D-109)" />
        </div>
        {product.currency && product.currency !== 'INR' ? (
          <p className="text-danger text-[13px]">
            This page priced it in {product.currency}: enter the price in rupees.
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="text-danger text-[14px]">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2 [&>button]:flex-1 md:[&>button]:flex-none">
          <button
            type="submit"
            disabled={pending || existing === undefined}
            className={secondaryButton}
          >
            {existing ? 'Update' : 'Save draft'}
          </button>
          <button
            type="button"
            disabled={pending || existing === undefined}
            onClick={() => save(true)}
            className={button}
          >
            {pending ? 'Saving…' : existing ? 'Update and publish' : 'Publish'}
          </button>
        </div>
      </div>
    </form>
  );
}
