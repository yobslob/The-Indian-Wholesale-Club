import { unwrap, type Enum, type IwcClient } from '../client';

// ---------------------------------------------------------------- pickups: the buy list (flows.md, D-140)

export async function markPickup(
  client: IwcClient,
  pickupId: string,
  status: Exclude<Enum<'pickup_status'>, 'pending'>,
  options: { photoPath?: string; note?: string } = {},
) {
  unwrap(
    await client.rpc('mark_pickup', {
      p_pickup: pickupId,
      p_status: status,
      ...(options.photoPath ? { p_photo_path: options.photoPath } : {}),
      ...(options.note ? { p_note: options.note } : {}),
    }),
  );
}

export interface WeighResult {
  weighed_g: number;
  listed_g: number | null;
  change_pct: number | null;
  old_cents: number | null;
  new_cents: number | null;
  /** "Weighed 310 g (listed 450 g, -31%): price now $25.30, was $17.33" */
  note: string;
  /** No weight before, or more than 10% off: the desk should see it. */
  big_change: boolean;
}

/**
 * D-130: a picked piece weighed at the hub (one piece, packed). Its option takes the weight (weighed, D-129), the
 * listing is repriced (D-128), and the pickup keeps the note.
 */
export async function weighPickup(client: IwcClient, pickupId: string, grams: number): Promise<WeighResult> {
  return unwrap(
    await client.rpc('admin_weigh_pickup', { p_pickup: pickupId, p_grams: grams }),
  ) as unknown as WeighResult;
}
