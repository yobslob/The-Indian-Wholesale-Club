import type { Enum } from '@repo/db';

/**
 * Status chips in plain words and colours (D-096): the database's words (`in_transit`, `partially_refunded`) are never
 * shown. Admin only: the customer sees its own seven statuses (order-status.ts, D-003).
 */
export type Tone = 'ok' | 'warn' | 'bad' | 'brand' | 'blue' | 'mute';

const TONE: Record<Tone, string> = {
  ok: 'bg-positive/10 text-positive',
  warn: 'bg-caution/[0.12] text-caution',
  bad: 'bg-danger/10 text-danger',
  brand: 'bg-brand/10 text-brand',
  blue: 'bg-[#1e4078]/10 text-[#1e4078]',
  mute: 'bg-surface text-ink-muted',
};

export function Chip({ tone = 'mute', children }: { tone?: Tone; children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      className={`font-ui inline-flex h-[22px] items-center gap-[5px] whitespace-nowrap rounded-full px-2 text-[11.5px] font-semibold leading-none before:h-1.5 before:w-1.5 before:rounded-full before:bg-current before:opacity-70 ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export const ORDER_STATUS: Record<Enum<'order_status'>, [string, Tone]> = {
  pending_payment: ['Awaiting payment', 'mute'],
  confirmed: ['Confirmed', 'blue'],
  collecting: ['Collecting in India', 'warn'],
  packed: ['Packed in India', 'warn'],
  in_transit: ['On the way to the US', 'warn'],
  arrived: ['Arrived · to ship', 'brand'],
  shipped: ['Shipped', 'ok'],
  delivered: ['Delivered', 'ok'],
  cancelled: ['Cancelled', 'mute'],
  refunded: ['Refunded', 'mute'],
};

export const PAYMENT_STATUS: Record<Enum<'payment_status'>, [string, Tone]> = {
  pending: ['Awaiting payment', 'mute'],
  paid: ['Paid', 'ok'],
  failed: ['Failed', 'bad'],
  refunded: ['Refunded', 'mute'],
  partially_refunded: ['Part refunded', 'warn'],
};

export const PICKUP_STATUS: Record<Enum<'pickup_status'>, [string, Tone]> = {
  pending: ['To pick', 'warn'],
  picked: ['Picked', 'ok'],
  unavailable: ['Unavailable', 'bad'],
};

export const CYCLE_STATUS: Record<Enum<'cycle_status'>, [string, Tone]> = {
  open: ['Open', 'blue'],
  collecting: ['Collecting', 'warn'],
  packed: ['Packed', 'warn'],
  exported: ['Exported', 'warn'],
  arrived: ['Arrived', 'brand'],
  fulfilling: ['Fulfilling', 'brand'],
  closed: ['Closed', 'mute'],
};

export const PRODUCT_STATUS: Record<Enum<'product_status'>, [string, Tone]> = {
  draft: ['Draft', 'mute'],
  live: ['Live', 'ok'],
  paused: ['Paused', 'warn'],
  archived: ['Archived', 'mute'],
};

export function StatusChip<K extends string>({ map, status }: { map: Record<K, [string, Tone]>; status: K }): React.JSX.Element {
  const [label, tone] = map[status] ?? [status, 'mute'];
  return <Chip tone={tone}>{label}</Chip>;
}
