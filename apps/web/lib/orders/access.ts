import { createClient } from '@/lib/supabase/server';

/**
 * Ownership checks for customer-facing order pages (BUGS.md C2).
 *
 * An order may only be viewed when the caller is:
 *  - the authenticated user who placed it (order.user_id), or
 *  - signed in with the email the order was placed with, or
 *  - able to claim the exact order email (step-up via ?email= / form).
 */

export function normalizeEmail(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export interface OrderOwnershipFields {
  user_id?: string | null;
  shipping_address?: unknown;
}

export function orderEmailOf(order: OrderOwnershipFields): string | null {
  const address = (order.shipping_address ?? {}) as Record<string, unknown>;
  const raw = typeof address.email === 'string' ? address.email : null;
  return normalizeEmail(raw);
}

export function orderMatchesEmail(order: OrderOwnershipFields, claimed: string | null): boolean {
  const orderEmail = orderEmailOf(order);
  if (!orderEmail || !claimed) return false;
  return orderEmail === claimed;
}

export async function getViewer(): Promise<{ userId: string | null; email: string | null }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { userId: null, email: null };
    return { userId: user.id, email: normalizeEmail(user.email) };
  } catch {
    return { userId: null, email: null };
  }
}

/** True when the signed-in session already owns this order. */
export async function sessionCanViewOrder(order: OrderOwnershipFields): Promise<boolean> {
  const viewer = await getViewer();
  if (viewer.userId && order.user_id && viewer.userId === order.user_id) return true;
  if (viewer.email && orderMatchesEmail(order, viewer.email)) return true;
  return false;
}

/** True when the session owns the order or the claimed email matches it. */
export async function canViewOrder(
  order: OrderOwnershipFields,
  claimedEmail?: string | null,
): Promise<boolean> {
  if (await sessionCanViewOrder(order)) return true;
  return orderMatchesEmail(order, normalizeEmail(claimedEmail));
}
