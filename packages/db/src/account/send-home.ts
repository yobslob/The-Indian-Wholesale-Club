import { unwrap, type IwcClient } from '../client';

import type { Relation } from '@repo/shared/domain';

/**
 * D-205, Account → Your people at home: the customer's own loved ones (RLS: the owner only) and the switch that starts
 * the bag's card with or without the gift. The UPI is checked by the caller (upiOf) and again by the table.
 */
export interface LovedOneInput {
  relation: Relation;
  callName: string;
  /** Null when editing keeps the UPI already saved (the customer only ever sees it masked). */
  upi: string | null;
  regionId: string | null;
  note: string;
}

export async function saveLovedOne(client: IwcClient, userId: string, id: string | null, input: LovedOneInput): Promise<void> {
  const row = {
    relation: input.relation,
    call_name: input.callName,
    region_id: input.regionId,
    note: input.note,
    ...(input.upi ? { upi: input.upi } : {}),
  };
  if (id) unwrap(await client.from('loved_ones').update(row).eq('id', id).eq('profile_id', userId));
  else if (input.upi) unwrap(await client.from('loved_ones').insert({ ...row, upi: input.upi, profile_id: userId }));
}

/** Removed from the list, kept for the gifts already sent to them (their history still names them). */
export async function archiveLovedOne(client: IwcClient, userId: string, id: string): Promise<void> {
  unwrap(
    await client.from('loved_ones').update({ archived_at: new Date().toISOString() }).eq('id', id).eq('profile_id', userId),
  );
}

export async function setSendHomeInBag(client: IwcClient, userId: string, on: boolean): Promise<void> {
  unwrap(await client.from('profiles').update({ send_home_in_bag: on }).eq('id', userId));
}
