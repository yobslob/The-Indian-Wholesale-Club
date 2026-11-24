import { formatInr } from '@repo/shared/domain';

import { GiftBar } from './gift-bar';
import { SEND_HOME_WORDS } from './words';

import type { OrderHomeGift } from '@repo/db/store';

/** D-205, D-206: the order page's gift: to whom, how many rupees, and the bar that fills once it has gone. */
export function OrderGift({ gift }: { gift: OrderHomeGift }): React.JSX.Element {
  const inr = formatInr(gift.inr_paise);
  return (
    <section aria-label={SEND_HOME_WORDS.card.kicker} className="bg-paper border-brand/60 grid gap-2.5 rounded-[18px] border p-4">
      <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{SEND_HOME_WORDS.postcard.stamp}</p>
      <p className="font-heading text-ink m-0 text-[17px] font-semibold">
        {SEND_HOME_WORDS.bill.lineTo(inr, gift.call_name)}
        {gift.region_name ? <span className="font-ui text-ink-muted text-[13px] font-normal"> · {gift.region_name}</span> : null}
      </p>
      {gift.note ? <p className="font-hand text-caution m-0 text-[16px]">&ldquo;{gift.note}&rdquo;</p> : null}
      <GiftBar status={gift.customer_status} name={gift.call_name} relation={gift.relation} />
      <p className="font-ui text-ink-muted m-0 text-[12px]">
        {SEND_HOME_WORDS.postcard.upi(gift.upi_masked)}
        {gift.utr_last4 ? ` · ${SEND_HOME_WORDS.bar.reference(gift.utr_last4)}` : ''}
      </p>
    </section>
  );
}
