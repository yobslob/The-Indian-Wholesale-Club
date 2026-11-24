import Link from 'next/link';

import { formatInr, type Relation } from '@repo/shared/domain';

import { GiftBar } from './gift-bar';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.postcard;
const today = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * D-205 §4.5, the thank-you page's postcard: a paper card tilted a little, a wine stamp with the rupees, a postmark from
 * the customer's state, who it is on its way to, and the bar (D-206) that fills once the desk has sent it. Outside the
 * bag the wine-and-gold look stays (the founder kept wine off the bag only).
 */
export function Postcard({
  gift,
  state,
  signedIn,
}: {
  gift: { inrPaise: number; callName: string; relation: Relation };
  state: string | null;
  signedIn: boolean;
}): React.JSX.Element {
  const inr = formatInr(gift.inrPaise);
  return (
    <section
      aria-label={W.stamp}
      className="bg-paper relative max-w-[440px] -rotate-[1.2deg] rounded-[14px] p-5 pr-24 shadow-[0_10px_30px_rgba(30,27,22,0.14)] motion-reduce:rotate-0"
    >
      <span
        aria-hidden="true"
        className="border-brand bg-brand text-on-brand font-display absolute right-4 top-4 grid h-[68px] w-[56px] place-items-center rounded-[4px] border-[3px] border-dotted text-center text-[13px] leading-tight"
      >
        ♥<br />
        {inr}
      </span>
      <span
        aria-hidden="true"
        className="border-brand/40 text-brand/70 font-ui absolute right-[60px] top-[58px] grid h-14 w-14 rotate-[-14deg] place-items-center rounded-full border text-center text-[9px] font-bold uppercase leading-tight"
      >
        {state ? `${state} · USA` : 'USA'}
        <br />
        {today.format(new Date())}
      </span>
      <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{W.stamp}</p>
      <h2 className="font-heading text-ink mt-1.5 text-[clamp(20px,2.2vw,26px)] font-semibold leading-tight">
        {W.headline(inr, gift.callName)}
      </h2>
      <p className="font-ui text-ink-muted mt-2 text-[13px]">{W.to(gift.callName)}</p>
      <div className="mt-3">
        <GiftBar status="sending" name={gift.callName} relation={gift.relation} />
      </div>
      <p className="font-ui text-ink-muted mt-3 text-[12.5px]">{W.emailNote}</p>
      {signedIn ? (
        <Link href="/account/people" className="font-ui text-ink mt-1 inline-block min-h-8 text-[13px] font-semibold underline underline-offset-[3px]">
          {W.seeAll}
        </Link>
      ) : null}
    </section>
  );
}
