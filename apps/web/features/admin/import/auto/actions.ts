'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';

import {
  addTargets,
  checkSourcesSoon,
  deleteTarget,
  listCategories,
  listRegionsAdmin,
  listSourcedDrafts,
  listSourcingShops,
  publishProducts,
  reviewSource,
  requeueNothingFit,
  setTargetsStatus,
  updateSourcingSettings,
  updateSourcingShop,
} from '@repo/db/admin';
import { attributesSchemaFor, PRODUCT_TYPES } from '@repo/shared/domain';
import { parseTargetsCsv } from '@repo/shared/sourcing/auto';

import { STORE_TAG } from '@/features/catalog/data';

import { requireAdminAction } from '../../guard';
import { refreshListings } from '../../refresh-listings';

/** Auto-sourcing (D-118): the admin's side of the runner. Every write is checked again by RLS (is_admin()). */

const PAGE = '/admin/import/auto';
const id = z.string().uuid();
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

export async function saveSourcingSettingsAction(form: FormData): Promise<void> {
  const { client, user } = await requireAdminAction();
  const input = z
    .object({
      max_delivery_days: int(0, 15),
      listings_per_target: int(1, 10),
      check_every_days: int(1, 30),
      qty_per_variant: int(0, 99),
      targets_per_run: int(1, 500),
      max_rise_pct: int(5, 1000),
      max_drop_pct: int(5, 95),
    })
    .parse(Object.fromEntries(form));
  await updateSourcingSettings(client, {
    ...input,
    auto_publish: form.get('auto_publish') === 'on',
    updated_by: user.id,
  });
  revalidatePath(PAGE);
}

export async function setShopAction(site: string, form: FormData): Promise<void> {
  const { client } = await requireAdminAction();
  const days = String(form.get('delivery_days') ?? '').trim();
  await updateSourcingShop(client, z.string().min(3).parse(site), {
    is_enabled: form.get('is_enabled') === 'on',
    delivery_days: days === '' ? null : int(0, 30).parse(days),
  });
  revalidatePath(PAGE);
}

export type UploadResult = { added: number; skipped: number; errors: string[] } | { error: string };

/**
 * A target list as CSV (the state bestseller list's columns): rows already there for that state are skipped. D-121:
 * an empty state (or "all") is all states; shops are matched to the shop list by name or host ("myntra").
 */
export async function uploadTargetsAction(csv: string): Promise<UploadResult> {
  const { client, user } = await requireAdminAction();
  const text = z.string().max(2_000_000).parse(csv);
  const { rows, errors } = parseTargetsCsv(text);
  if (!rows.length) return { error: errors[0] ?? 'No rows found.' };
  const [regions, categories, shopList] = await Promise.all([
    listRegionsAdmin(client),
    listCategories(client),
    listSourcingShops(client),
  ]);
  const siteOf = (typed: string): string | undefined =>
    shopList.find(
      (s) => s.site === typed || s.site.split('.')[0] === typed || s.label.toLowerCase() === typed,
    )?.site;
  const regionId = new Map(regions.map((r) => [r.slug, r.id]));
  const category = new Map(categories.map((c) => [c.slug, c]));
  const ready = rows.flatMap((r, i) => {
    const c = category.get(r.category);
    const region = r.region === null ? null : regionId.get(r.region);
    const sites = r.shops?.map(siteOf);
    const problem =
      region === undefined
        ? `no state "${r.region}"`
        : !c || c.product_type !== r.product_type
          ? `no ${r.product_type} category "${r.category}"`
          : sites?.some((s) => !s)
            ? `no shop "${r.shops![sites.indexOf(undefined)]}"`
            : r.min_price_paise && r.max_price_paise && r.max_price_paise < r.min_price_paise
              ? 'the price band runs high to low'
              : null;
    if (problem || !c || region === undefined) {
      errors.push(`${r.name}: ${problem ?? 'not valid'} (row ${i + 2}).`);
      return [];
    }
    return [
      {
        name: r.name,
        query: r.query,
        must_match: r.must_match,
        product_type: r.product_type,
        category_id: c.id,
        region_id: region,
        tier: r.tier,
        sites: sites ? [...new Set(sites as string[])] : null,
        min_price_paise: r.min_price_paise,
        max_price_paise: r.max_price_paise,
        listings: r.listings,
        created_by: user.id,
      },
    ];
  });
  try {
    const added = await addTargets(client, ready);
    revalidatePath(PAGE);
    return { added, skipped: ready.length - added, errors: errors.slice(0, 20) };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message.slice(0, 200) : 'Could not save the targets.',
    };
  }
}

export async function setTargetAction(
  targetId: string,
  status: 'queued' | 'paused',
): Promise<void> {
  const { client } = await requireAdminAction();
  await setTargetsStatus(client, [id.parse(targetId)], status);
  revalidatePath(PAGE);
}

export async function searchNothingFitAgainAction(): Promise<void> {
  const { client } = await requireAdminAction();
  await requeueNothingFit(client);
  revalidatePath(PAGE);
}

export async function deleteTargetAction(targetId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await deleteTarget(client, id.parse(targetId));
  revalidatePath(PAGE);
}

export async function reviewSourceAction(sourceId: string, accept: boolean): Promise<void> {
  const { client } = await requireAdminAction();
  await reviewSource(client, id.parse(sourceId), accept);
  revalidateTag(STORE_TAG);
  revalidatePath(PAGE);
}

export async function checkSoonAction(productId: string): Promise<void> {
  const { client } = await requireAdminAction();
  await checkSourcesSoon(client, id.parse(productId));
  revalidatePath(`/admin/catalog/${productId}`);
}

/**
 * Publishes every found draft that has a photo and every detail customers must see (food: once cleared, D-074); the
 * database holds one with an option that has no weight (D-129), listed under Products → Weights to check.
 */
export async function publishReadyAction(): Promise<void> {
  const { client } = await requireAdminAction();
  const drafts = await listSourcedDrafts(client);
  const ready = drafts.filter(
    (d) =>
      d.media.length > 0 &&
      (PRODUCT_TYPES as readonly string[]).includes(d.product_type) &&
      attributesSchemaFor(d.product_type).safeParse(d.attributes).success,
  );
  // one at a time, so a food listing refused before food is cleared doesn't stop the others
  for (const d of ready) await publishProducts(client, [d.id]).catch(() => undefined);
  await refreshListings(client, ready.map((d) => d.id), true);
  revalidatePath(PAGE);
}
