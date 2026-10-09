import { orderEventLabel } from '@repo/shared/domain';

/** Internal order events in plain words for the admin's timeline (D-096). Customer-visible ones read as the customer sees them. */
const INTERNAL: Record<string, string> = {
  note: 'Note',
  delay_kept: 'The customer kept the order with the new date',
  moved_to_cycle: 'Moved to another cycle',
};

export function adminEventText(e: { kind: string; visible_to_customer: boolean; message: string | null; internal_note: string | null }): {
  text: string;
  note: string | null;
} {
  const base = e.visible_to_customer
    ? orderEventLabel(e.kind)
    : (INTERNAL[e.kind] ?? e.kind.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));
  return { text: e.message ? `${base} · ${e.message}` : base, note: e.internal_note };
}
