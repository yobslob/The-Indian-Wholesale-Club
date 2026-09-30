'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import {
  createProduct,
  createVariant,
  createVendor,
  getVendor,
  setListedQty,
  setProductStatus,
  updateProduct,
} from '@repo/db/admin';
import { clothingAttributesSchema, spiceAttributesSchema } from '@repo/shared/domain';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../guard';

const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug: lowercase letters, digits and dashes');
const dollarsToCents = z.coerce
  .number()
  .positive()
  .transform((v) => Math.round(v * 100));
const rupeesToPaise = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
  .refine(
    (v) => v === null || (Number.isFinite(v) && v >= 0),
    'shop price must be a positive number',
  );

function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

// ---------------------------------------------------------------- vendors (admin only, D-003, D-018)

export async function createVendorAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const input = z
    .object({
      shopName: text(120).pipe(z.string().min(2)),
      ownerName: optional(120),
      phone: optional(40),
      whatsapp: optional(40),
      town: optional(80),
      regionId: id,
      paymentMethod: optional(40),
      paymentReference: optional(120),
      notes: optional(1000),
    })
    .parse(Object.fromEntries(form));
  await createVendor(client, {
    shop_name: input.shopName,
    owner_name: input.ownerName,
    phone: input.phone,
    whatsapp: input.whatsapp,
    town: input.town,
    region_id: input.regionId,
    payment_method: input.paymentMethod,
    payment_reference: input.paymentReference,
    notes: input.notes,
    status: 'active',
    onboarded_at: new Date().toISOString(),
    onboarded_by: user.id,
  });
  revalidatePath('/admin/vendors');
}

// ---------------------------------------------------------------- products (flows.md §2)

/** Draft listing: the region comes from the vendor; attributes are validated per type (D-003). */
export async function createProductAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const base = z
    .object({
      vendorId: id,
      categoryId: id,
      productType: z.enum(['clothing', 'spice']),
      name: text(120).pipe(z.string().min(2)),
      slug,
      price: dollarsToCents,
      shopPrice: rupeesToPaise,
      summary: optional(300),
    })
    .parse(Object.fromEntries(form));
  const attributes =
    base.productType === 'clothing'
      ? clothingAttributesSchema.parse({
          fibre_content: field(form, 'fibre'),
          care: field(form, 'care'),
        })
      : spiceAttributesSchema.parse({
          ingredients: field(form, 'ingredients'),
          allergens: field(form, 'allergens')
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
          shelf_life_days: Number(field(form, 'shelfLifeDays')),
        });
  const vendor = await getVendor(client, base.vendorId);
  if (!vendor) throw new Error('Vendor not found');
  const created = await createProduct(client, {
    vendor_id: vendor.id,
    region_id: vendor.region_id,
    category_id: base.categoryId,
    product_type: base.productType,
    name: base.name,
    slug: base.slug,
    price_cents: base.price,
    shop_price_paise: base.shopPrice,
    summary: base.summary,
    attributes,
    status: 'draft',
    created_by: user.id,
  });
  redirect(`/admin/catalog/${created.id}`);
}

export async function updateProductAction(productId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      name: text(120).pipe(z.string().min(2)),
      price: dollarsToCents,
      shopPrice: rupeesToPaise,
      summary: optional(300),
      description: optional(4000),
      story: optional(4000),
      craft: optional(120),
    })
    .parse(Object.fromEntries(form));
  await updateProduct(client, id.parse(productId), {
    name: input.name,
    price_cents: input.price,
    shop_price_paise: input.shopPrice,
    summary: input.summary,
    description: input.description,
    story: input.story,
    craft: input.craft,
  });
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Curated for you (D-056): an admin's pick shows on its region page and the region's product pages. */
export async function setProductCuratedAction(productId: string, curated: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await updateProduct(client, id.parse(productId), { is_curated: z.boolean().parse(curated) });
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Publishing makes it visible in the store. The database refuses live spices (D-032). */
export async function setProductStatusAction(
  productId: string,
  status: 'draft' | 'live' | 'paused' | 'archived',
): Promise<void> {
  const { client } = await requireAdminAction();
  await setProductStatus(
    client,
    id.parse(productId),
    z.enum(['draft', 'live', 'paused', 'archived']).parse(status),
  );
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath('/admin/listings');
}

export async function addVariantAction(productId: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({
      label: text(60).pipe(z.string().min(1)),
      sku: text(60).pipe(z.string().min(2)),
      qty: z.coerce.number().int().min(0).max(10000),
      price: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Math.round(Number(v) * 100)))
        .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'price must be positive'),
      weightG: z
        .string()
        .trim()
        .transform((v) => (v === '' ? null : Number(v)))
        .refine(
          (v) => v === null || (Number.isInteger(v) && v > 0),
          'weight must be a positive integer',
        ),
    })
    .parse(Object.fromEntries(form));
  await createVariant(client, {
    product_id: id.parse(productId),
    label: input.label,
    sku: input.sku,
    qty_listed: input.qty,
    price_cents: input.price,
    weight_g: input.weightG,
    qty_confirmed_at: new Date().toISOString(),
  });
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
}

/** Stock correction with a ledger note; also counts as re-confirmed with the shop (INV-4). */
export async function setQtyAction(
  productId: string,
  variantId: string,
  form: FormData,
): Promise<void> {
  const { client } = await requireAdminAction();
  const input = z
    .object({ qty: z.coerce.number().int().min(0).max(10000), note: optional(200) })
    .parse({ qty: form.get('qty'), note: form.get('note') ?? '' });
  await setListedQty(client, id.parse(variantId), input.qty, input.note ?? undefined);
  revalidateTag(STORE_TAG);
  revalidatePath(`/admin/catalog/${productId}`);
}
