'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import {
  createListing,
  createVariant,
  getSourcedProduct,
  onlineVendorFor,
  removeProductMedia,
  setListedQty,
  setProductStatus,
  syncImportSources,
  updateSourcedProduct,
  updateVariant,
} from '@repo/db/admin';
import {
  attributesSchemaFor,
  listingSlug,
  PRODUCT_TYPES,
  WEARS,
  type ListingInput,
} from '@repo/shared/domain';
import {
  importVariants,
  siteLabel,
  sourcedProductSchema,
  type SourcedProduct,
} from '@repo/shared/sourcing';

import { STORE_TAG } from '@/features/catalog/data';
import { removePhotos } from '@/lib/photo-copies';

import { requireAdminAction } from '../guard';

import { copySourcePhotos, readSourcePage } from './server';

export type ExistingListing = {
  id: string;
  name: string;
  status: string;
  region: string | null;
  shopPricePaise: number | null;
  priceCents: number;
};
export type ReadResult = { url: string; product: SourcedProduct } | { url: string; error: string };
export type ImportResult =
  { id: string; updated: boolean; published: boolean; note?: string } | { error: string };

/** "Paste links": the server reads each page (at most 20, four at a time). */
export async function readLinksAction(urls: string[]): Promise<ReadResult[]> {
  await requireAdminAction();
  const list = z.array(z.string().trim().max(2000)).max(20).parse(urls).filter(Boolean);
  const results: ReadResult[] = [];
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(
      list.slice(i, i + 4).map(async (url) => ({ url, ...(await readSourcePage(url)) })),
    );
    results.push(...batch);
  }
  return results;
}

/** The listing already made from this page, so the form can say it will update it. */
export async function findImportedAction(sourceUrl: string): Promise<ExistingListing | null> {
  const { client } = await requireAdminAction();
  const found = await getSourcedProduct(client, z.string().url().parse(sourceUrl));
  if (!found) return null;
  return {
    id: found.id,
    name: found.name,
    status: found.status,
    region: found.region?.name ?? null,
    shopPricePaise: found.shop_price_paise,
    priceCents: found.price_cents,
  };
}

const importSchema = z.object({
  product: sourcedProductSchema,
  /** Null: all states, no state tag (D-121). */
  regionId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  productType: z.enum(PRODUCT_TYPES),
  /** D-140: who it is for (clothing must have it to go live). */
  wears: z.enum(WEARS).nullable().default(null),
  name: z.string().trim().min(2, 'Give it a name.').max(120),
  summary: z.string().trim().max(300),
  description: z.string().trim().max(4000),
  attributes: z.unknown(),
  photos: z.array(z.string().url()).max(12),
  /** Pieces offered for each size the shop has (the shop's own stock is unknown). */
  qtyPerSize: z.number().int().min(0).max(99),
  weightG: z.number().int().positive().max(50_000).nullable(),
  /** What the page said when the weight is the page's own reading (D-129); null = typed by the admin. */
  weightNote: z.string().max(200).nullable().default(null),
  shopPricePaise: z.number().int().positive('Enter the price on the shop.').max(100_000_000),
  publish: z.boolean(),
  /** Only for a page imported before: also replace its name, words and photos (otherwise only price and sizes). */
  replaceDetails: z.boolean(),
});
export type ImportInput = z.input<typeof importSchema>;

function plain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('wears_missing')) return 'Choose who it is for (Women, Men, Kids or Everyone) first.';
  if (message.includes('weight_missing'))
    return 'It needs its weight first: weigh it, or type the weight the shop states (D-129).';
  if (message.includes('care_missing')) return 'Add its care (how to wash it) first: US customers are owed it (D-140).';
  if (message.includes('price_needed'))
    return 'The price could not be worked out: check the pricing numbers in Settings.';
  if (message.includes('products_food_not_live'))
    return 'Food goes live once “Food is cleared” is on in Settings (D-074).';
  if (message.includes('products_source_url_key') || message.includes('duplicate key'))
    return 'This page was just imported. Reload the page and try again.';
  return message.length < 200 ? message : 'Could not save. Try again.';
}

async function publishOrNote(
  client: Parameters<typeof setProductStatus>[0],
  id: string,
): Promise<{ published: boolean; note?: string }> {
  try {
    await setProductStatus(client, id, 'live');
    return { published: true };
  } catch (error) {
    return { published: false, note: `Saved as a draft, not published: ${plain(error)}` };
  }
}

/**
 * Saves an imported product (D-110). A new page becomes a listing of the shop's online vendor in the chosen state,
 * priced from the shop's price (D-109), with its photos copied. A page imported before keeps its listing: the price,
 * the sizes in stock and the check date are updated, and with "replace" its name, words and photos too.
 */
export async function saveImportAction(raw: ImportInput): Promise<ImportResult> {
  const { client, user } = await requireAdminAction();
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const input = parsed.data;
  const attributes = attributesSchemaFor(input.productType).safeParse(input.attributes);
  if (!attributes.success)
    return {
      error: `Fill in ${String(attributes.error.issues[0]?.path[0] ?? 'the details').replace(/_/g, ' ')}.`,
    };
  const photos = input.photos.filter((p) => input.product.images.includes(p));
  // the page's flavours, packs or colours with their own prices when it has them, else its sizes (D-118)
  const variants = importVariants(
    input.product,
    input.qtyPerSize,
    input.weightG
      ? {
          grams: input.weightG,
          source: input.weightNote ? 'shop' : 'admin',
          note: input.weightNote ? `${input.product.site}: ${input.weightNote}`.slice(0, 200) : null,
        }
      : null,
  );
  const inStock = variants.some((v) => v.qty > 0);
  const checked = new Date().toISOString();

  try {
    const existing = await getSourcedProduct(client, input.product.url);
    if (existing) {
      await updateSourcedProduct(client, existing.id, {
        shop_price_paise: input.shopPricePaise,
        source_checked_at: checked,
        source_in_stock: inStock,
        // who it is for is set when chosen, even without "Also replace" (it was never set before D-140)
        ...(input.wears ? { wears: input.wears } : {}),
        ...(input.replaceDetails
          ? {
              name: input.name,
              summary: input.summary || null,
              description: input.description || null,
              attributes: attributes.data,
            }
          : {}),
      });
      let next = existing.variants.reduce((n, v) => Math.max(n, v.sort_order), 0);
      for (const v of variants) {
        const current = existing.variants.find(
          (e) => e.label.toLowerCase() === v.label.toLowerCase(),
        );
        if (current) {
          const target = Math.max(v.qty, current.qty_reserved);
          if (target !== current.qty_listed)
            await setListedQty(client, current.id, target, `Checked on ${input.product.site}`);
          if (v.shop_price_paise)
            await updateVariant(client, current.id, { shop_price_paise: v.shop_price_paise });
          // D-129: an option still without a weight takes the one read or typed now
          if (current.weight_g === null && v.weight_g)
            await updateVariant(client, current.id, {
              weight_g: v.weight_g,
              weight_source: v.weight_source ?? null,
              weight_note: v.weight_note ?? null,
            });
        } else {
          next += 1;
          await createVariant(client, {
            product_id: existing.id,
            sku: `${existing.slug.toUpperCase()}-${next}`,
            label: v.label,
            options: v.options,
            qty_listed: v.qty,
            weight_g: v.weight_g ?? null,
            weight_source: v.weight_source ?? null,
            weight_note: v.weight_note ?? null,
            sort_order: next,
            qty_confirmed_at: checked,
            shop_price_paise: v.shop_price_paise ?? null,
          });
        }
      }
      // Sizes the shop no longer lists stop selling (pieces already ordered stay reserved).
      for (const e of existing.variants) {
        if (
          !variants.some((v) => v.label.toLowerCase() === e.label.toLowerCase()) &&
          e.qty_listed > e.qty_reserved
        ) {
          await setListedQty(client, e.id, e.qty_reserved, `No longer on ${input.product.site}`);
        }
      }
      await recordSources(client, existing.id, input.product, variants);
      let note: string | undefined;
      if (input.replaceDetails && photos.length) {
        const old = await removeProductMedia(client, existing.id);
        if (old.length) await removePhotos(client, 'product-media', old);
        const { failed } = await copySourcePhotos(client, existing.id, photos, input.name);
        if (failed) note = `${failed} photo${failed === 1 ? '' : 's'} could not be copied.`;
      }
      const status =
        input.publish && existing.status !== 'live'
          ? await publishOrNote(client, existing.id)
          : { published: existing.status === 'live' };
      done(existing.id);
      return {
        id: existing.id,
        updated: true,
        published: status.published,
        note:
          [note, 'note' in status ? status.note : undefined].filter(Boolean).join(' ') || undefined,
      };
    }

    const vendorId = await onlineVendorFor(
      client,
      input.product.site,
      siteLabel(input.product.site),
      input.regionId,
      user.id,
    );
    const listing = {
      vendor_id: vendorId,
      category_id: input.categoryId,
      product_type: input.productType,
      name: input.name,
      slug: listingSlug(input.name, crypto.randomUUID().slice(0, 4)),
      summary: input.summary || undefined,
      shop_price_paise: input.shopPricePaise,
      attributes: attributes.data,
      variants: variants.map((v) => ({
        label: v.label,
        options: v.options,
        qty: v.qty,
        weight_g: v.weight_g,
        weight_source: v.weight_source,
        weight_note: v.weight_note,
        shop_price_paise: v.shop_price_paise,
      })),
    } as ListingInput;
    const id = await createListing(client, listing);
    await updateSourcedProduct(client, id, {
      ...(input.wears ? { wears: input.wears } : {}),
      shop_title: input.product.title.slice(0, 300),
      description: input.description || null,
      source_url: input.product.url,
      source_site: input.product.site,
      source_checked_at: checked,
      source_in_stock: inStock,
    });
    await recordSources(client, id, input.product, variants);
    const { failed } = await copySourcePhotos(client, id, photos, input.name);
    const status = input.publish ? await publishOrNote(client, id) : { published: false };
    done(id);
    const notes = [
      failed ? `${failed} photo${failed === 1 ? '' : 's'} could not be copied.` : '',
      'note' in status ? status.note : '',
    ].filter(Boolean);
    return { id, updated: false, published: status.published, note: notes.join(' ') || undefined };
  } catch (error) {
    return { error: plain(error) };
  }
}

/** The shop items behind the listing's variants, for the weekly check (D-118). */
async function recordSources(
  client: Parameters<typeof syncImportSources>[0],
  productId: string,
  product: SourcedProduct,
  variants: ReturnType<typeof importVariants>,
): Promise<void> {
  const saved = await getSourcedProduct(client, product.url);
  if (!saved) return;
  const items = saved.variants.flatMap((sv) => {
    const v = variants.find((x) => x.label.toLowerCase() === sv.label.toLowerCase());
    if (!v) return [];
    return [
      {
        variantId: sv.id,
        key: v.source?.key ?? null,
        url: v.source?.url ?? product.url,
        pricePaise: v.source?.pricePaise ?? product.pricePaise ?? v.shop_price_paise ?? 0,
        inStock: v.qty > 0,
      },
    ];
  });
  await syncImportSources(
    client,
    productId,
    product.site,
    product.url,
    items.filter((i) => i.pricePaise > 0),
  );
}

function done(id: string): void {
  revalidateTag(STORE_TAG);
  revalidatePath('/admin/import/listings');
  revalidatePath('/admin/catalog');
  revalidatePath(`/admin/catalog/${id}`);
}
