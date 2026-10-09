import type { Tone } from '@repo/shared/admin';

export type { Tone };

/**
 * Status chips in plain words and colours (D-096): the database's words (`in_transit`, `partially_refunded`) are never
 * shown. Admin only: the customer sees its own seven statuses (order-status.ts, D-003).
 */
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

export { CYCLE_STATUS, ORDER_STATUS, PAYMENT_STATUS, PICKUP_STATUS, PRODUCT_STATUS } from '@repo/shared/admin';

export function StatusChip<K extends string>({ map, status }: { map: Record<K, [string, Tone]>; status: K }): React.JSX.Element {
  const [label, tone] = map[status] ?? [status, 'mute'];
  return <Chip tone={tone}>{label}</Chip>;
}
