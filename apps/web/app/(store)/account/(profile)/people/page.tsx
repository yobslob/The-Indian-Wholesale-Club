import Link from 'next/link';

import { getMyPeople } from '@repo/db/store';
import { formatInr, formatUsd, upiOwnerWord } from '@repo/shared/domain';

import { customerOrNull } from '@/features/account/session';
import { removeLovedOneAction } from '@/features/send-home/people-actions';
import { PersonForm } from '@/features/send-home/person-form';
import { SEND_HOME_WORDS } from '@/features/send-home/words';
import { storeClient } from '@/lib/supabase/store';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your people at home', robots: { index: false } };

type Search = Promise<{ edit?: string; add?: string }>;
const W = SEND_HOME_WORDS.people;
const month = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * D-205 §4.7, Account → Your people at home: what has gone home (sent gifts only), each loved one with what they have
 * received, the history with each gift's state (D-206's words: Sending, in their UPI, refunded), and the switch that
 * starts the bag with or without the gift. One read (store_my_people) plus the states for the form when it is open.
 */
export default async function PeoplePage({ searchParams }: { searchParams: Search }): Promise<React.JSX.Element | null> {
  const me = await customerOrNull();
  if (!me) return null;
  const { edit, add } = await searchParams;
  const people = await getMyPeople(me.client);
  if (!people) return null;
  const editing = edit ? people.loved_ones.find((l) => l.id === edit) : undefined;
  const formOpen = Boolean(editing || add);
  const regions = formOpen
    ? ((await storeClient().from('store_regions').select('id, name').order('name')).data ?? [])
    : [];
  const t = people.total;
  return (
    <div className="grid gap-6">
      <section className="bg-brand text-on-brand rounded-lg p-[clamp(18px,2vw,28px)]">
        <p className="font-ui m-0 text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">{W.kicker}</p>
        <p className="font-display m-0 mt-1 text-[clamp(32px,4vw,44px)] leading-none">{formatInr(t.inr_paise)}</p>
        <p className="font-ui m-0 mt-2 text-[14px] opacity-90">
          {t.times > 0 && t.since ? W.totalLine(t.times, month.format(new Date(t.since)), formatUsd(t.usd_cents)) : W.nothingYet}
        </p>
      </section>
      {/* D-208: what the 5% saving put in Coins */}
      {people.kept.times > 0 ? <p className="font-ui text-ink-muted m-0 text-[14px]">{W.kept(people.kept.cents.toLocaleString('en-US'), people.kept.times)}</p> : null}
      {!people.on && t.times === 0 ? <p className="text-ink-muted">{W.off}</p> : null}

      <section className="grid gap-3">
        {people.loved_ones.map((l) => (
          <div key={l.id} className="bg-paper border-line flex items-center gap-3 rounded-lg border p-4">
            <span aria-hidden="true" className="border-gift-thread font-display grid size-10 shrink-0 place-items-center rounded-full border-2">
              {l.call_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-heading m-0 text-[17px] font-semibold">
                {l.call_name}
                {l.region_name ? <span className="font-ui text-ink-muted text-[13px] font-normal"> · {l.region_name}</span> : null}
              </p>
              <p className="font-ui text-ink-muted m-0 text-[13px]">
                UPI {l.upi_masked} · {W.sent(formatInr(l.sent_inr_paise), l.times)}
              </p>
            </div>
            <Link href={`/account/people?edit=${l.id}`} className="font-ui min-h-11 content-center text-sm font-semibold underline underline-offset-[3px]">
              {W.edit}
            </Link>
            <form action={removeLovedOneAction.bind(null, l.id)}>
              <button type="submit" className="font-ui text-ink-muted min-h-11 text-sm underline underline-offset-[3px]">
                {W.removePerson}
              </button>
            </form>
          </div>
        ))}
        {formOpen ? (
          <PersonForm key={editing?.id ?? 'new'} person={editing} regions={regions} />
        ) : (
          <Link href="/account/people?add=1" className="font-ui text-ink min-h-11 content-center text-[15px] font-semibold">
            {W.add}
          </Link>
        )}
      </section>

      {people.history.length > 0 ? (
        <section>
          <h2 className="font-heading m-0 mb-2 text-xl font-medium">{W.history}</h2>
          <ul className="border-line m-0 list-none border-t p-0">
            {people.history.map((h) => (
              <li key={h.id} className="border-line font-ui grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b py-3 text-sm">
                <span>
                  {day.format(new Date(h.created_at))} · {h.call_name}
                </span>
                <b>{formatInr(h.inr_paise)}</b>
                <span
                  className={`text-[13px] ${h.customer_status === 'sent' ? 'text-positive' : h.customer_status === 'sending' ? 'text-caution' : 'text-ink-muted'}`}
                >
                  {h.customer_status === 'sent'
                    ? W.status.sent(upiOwnerWord(h.relation))
                    : h.customer_status === 'sending'
                      ? W.status.sending
                      : W.status.refunded}
                </span>
                <Link href={`/orders/${encodeURIComponent(h.order_number)}`} className="text-ink-muted text-[13px] underline">
                  {h.order_number}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>
  );
}
