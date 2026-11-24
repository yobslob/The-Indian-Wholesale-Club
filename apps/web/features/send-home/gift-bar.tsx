import { upiOwnerWord, type Relation } from '@repo/shared/domain';

import { SEND_HOME_WORDS } from './words';

import type { OrderHomeGift } from '@repo/db/store';

const W = SEND_HOME_WORDS.bar;

/**
 * D-206: where a gift stands, as one bar that fills when the India desk marks it sent. No time is promised: the bar only
 * moves when it has really gone. A gift that could not be sent shows its refund instead.
 */
export function GiftBar({ status, name, relation }: { status: OrderHomeGift['customer_status']; name: string; relation: Relation }): React.JSX.Element {
  const sent = status === 'sent';
  const refunded = status === 'refunded';
  const label = sent ? W.sent(name, upiOwnerWord(relation)) : refunded ? W.refunded : W.sending(name);
  return (
    <div className="grid gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={sent ? 100 : refunded ? 0 : 10}
        className="bg-land h-2 overflow-hidden rounded-pill"
      >
        <div className={`h-full rounded-pill ${refunded ? 'bg-ink-muted w-0' : sent ? 'bg-positive w-full' : 'bg-gift-thread w-[10%]'}`} />
      </div>
      <p className={`font-ui m-0 text-[13px] ${sent ? 'text-positive font-semibold' : 'text-ink-muted'}`}>{label}</p>
    </div>
  );
}
