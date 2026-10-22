import { unwrap, type IwcClient } from '../client';

/**
 * D-146: the bulk steps behind Assign all, Accept all, Rename all and Archive the rest. Each call does one batch, well
 * inside the database's statement time limit; the website calls again until nothing is left.
 */

/** The listings with an option that has no weight (`weightPlanSchema` in @repo/shared/sourcing/estimate reads it). */
export async function weightPlan(client: IwcClient, limit = 40): Promise<unknown> {
  return unwrap(await client.rpc('admin_weight_plan', { p_limit: limit }));
}

export interface AssignResult {
  /** By the house rules (clothing class, food label). */
  ruled: number;
  /** The middle weight of similar pieces weighed before. */
  similar: number;
  /** The category's usual weight (too few similar pieces). */
  usual: number;
}

/** Writes weights to options that have none; a null weight is found by the database from similar pieces. */
export async function assignWeights(
  client: IwcClient,
  items: { variant_id: string; weight_g: number | null; source?: string; note?: string; net_qty?: string }[],
): Promise<AssignResult> {
  return unwrap(await client.rpc('admin_assign_weights', { p_items: items })) as unknown as AssignResult;
}

/** Accepts the weights Weights to check shows, up to `limit` options; returns how many. */
export async function acceptWeights(client: IwcClient, limit = 2000): Promise<number> {
  const r = unwrap(await client.rpc('admin_accept_weights', { p_limit: limit })) as unknown as { accepted: number };
  return r.accepted;
}

export interface ArchiveResult {
  no_photo: number;
  no_option: number;
  no_stock: number;
}

/** Drafts that cannot go live (no photo, no active option, nothing to sell) are archived, counted by reason. */
export async function archiveUnreadyDrafts(client: IwcClient): Promise<ArchiveResult> {
  return unwrap(await client.rpc('admin_archive_unready_drafts')) as unknown as ArchiveResult;
}
