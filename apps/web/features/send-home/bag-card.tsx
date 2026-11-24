'use client';

import { useEffect, useState } from 'react';

import { formatInr, formatUsd, RELATION_NAMES, upiOwnerWord, type Relation } from '@repo/shared/domain';

import { AmountChips, chip, picked, Thread, unpicked } from './amount-chips';
import { deviceLovedOne, useGiftStore } from './gift-store';
import { SheetHost } from './sheet-host';
import { useGiftView } from './use-gift';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.card;
const FIRST: Relation[] = ['maa', 'papa', 'didi'];
const whole = (cents: number): string => (cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents));
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** The card's light frame (plan §4: only the border is wine in the bag), with a line sewn 5 px inside it. */
function Frame({ children, label }: { children: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <section aria-label={label} className="bg-paper border-brand relative rounded-[20px] border-[1.5px] p-4 pr-12">
      <span aria-hidden="true" className="border-brand/35 pointer-events-none absolute inset-[5px] rounded-[15px] border border-dashed" />
      {children}
    </section>
  );
}

/**
 * D-205, the bag's Send home card (plan §4.1, §4.3): already added at the round-up, × to remove it for this bag, the
 * dollars sewn to the rupees, the amount chips, and Maa · Papa · Didi · Someone else where "Who's it for?" was (or the
 * customer's own people, again). Shows only in the US with a rate set; nothing in the bag panel, product pages or Home.
 */
export function SendHomeCard({ baseTotalCents }: { baseTotalCents: number | null }): React.JSX.Element | null {
  const view = useGiftView(baseTotalCents);
  const store = useGiftStore();
  const [changing, setChanging] = useState(false);

  // the first look at this bag adds the round-up (rule 7), for the last person sent to when there is one (rule 6)
  useEffect(() => {
    if (!view || store.started) return;
    const saved = view.settings.loved_ones[0]?.id ?? null;
    store.start(view.cents, !view.settings.in_bag, saved, saved ? null : deviceLovedOne());
  }, [view, store]);

  if (!view || !store.started) return null;
  const inr = formatInr(view.inrPaise);
  const usd = whole(view.cents);
  const person = view.person;

  if (!view.added) {
    return (
      <Frame label={W.kicker}>
        <div className="font-ui flex items-center justify-between gap-3 text-[13px]">
          <span className="text-ink">{W.removedAsk(formatInr(view.inrPaise))}</span>
          <button
            type="button"
            onClick={() => store.setRemoved(false)}
            className="border-brand text-ink -my-1 -mr-8 h-10 shrink-0 rounded-pill border-[1.5px] px-4 font-semibold"
          >
            {W.add(usd)}
          </button>
        </div>
      </Frame>
    );
  }

  const saved = view.settings.loved_ones;
  const again = person !== null;
  const people: { key: string; name: string; on: boolean; pick: () => void }[] = again
    ? [
        ...saved.slice(0, 3).map((l) => ({ key: l.id, name: l.call_name, on: l.id === person.savedId, pick: () => store.pickSaved(l.id) })),
        ...(person.savedId === null ? [{ key: 'typed', name: person.name, on: true, pick: () => store.ask(person.relation) }] : []),
      ].slice(0, 3)
    : FIRST.map((r) => ({ key: r, name: RELATION_NAMES[r], on: false, pick: () => store.ask(r) }));
  const last = person?.savedId ? saved.find((l) => l.id === person.savedId) : null;

  return (
    <Frame label={W.kicker}>
      <button
        type="button"
        onClick={() => store.setRemoved(true)}
        aria-label={W.remove}
        className="text-ink-muted absolute right-1 top-1 grid h-11 w-11 place-items-center rounded-full"
      >
        <span aria-hidden="true" className="border-line bg-canvas grid h-[26px] w-[26px] place-items-center rounded-full border text-[15px] leading-none">
          ×
        </span>
      </button>
      <div className="flex items-center gap-2.5">
        {again ? (
          <span aria-hidden="true" className="border-gift-thread font-display text-ink grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-[15px]">
            {person.name.slice(0, 1).toUpperCase()}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{W.kickerAdded}</p>
          <h2 className="font-heading text-ink m-0 text-[16px] font-semibold leading-tight">
            {again ? W.headAgain(usd, person.name) : W.headFirst(usd)}
          </h2>
        </div>
      </div>
      <p className="font-ui text-ink mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <b className="text-[15px]">{usd}</b>
        <Thread />
        <b className="font-display text-[22px] font-medium leading-none">{inr}</b>
        <span className="text-ink-muted text-[12px]">{again ? W.into(upiOwnerWord(person.relation)) : W.straight}</span>
      </p>
      {again ? (
        <p className="font-ui text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-3 text-[12px]">
          {last?.last_inr_paise && last.last_at
            ? W.lastTime(formatInr(last.last_inr_paise), day.format(new Date(last.last_at)))
            : W.nothingYet(person.name)}
          {!changing ? (
            <button type="button" onClick={() => setChanging(true)} className="text-ink min-h-8 font-semibold underline underline-offset-[3px]">
              {W.changeAmount}
            </button>
          ) : null}
        </p>
      ) : null}
      {!again || changing ? (
        <div className="mt-3">
          <AmountChips
            chips={view.chips}
            cents={view.cents}
            roundUpCents={view.roundUpCents}
            roundUpTotalCents={view.roundUpTotalCents}
            maxCents={view.maxCents}
            onPick={store.setCents}
          />
        </div>
      ) : null}
      <div className="border-line mt-3 grid grid-cols-4 gap-1.5 border-t border-dashed pt-3" aria-label={W.whoChips} role="group">
        {people.map((p) => (
          <button key={p.key} type="button" onClick={p.pick} aria-pressed={p.on} className={`${chip} h-10 truncate px-1 ${p.on ? picked : unpicked}`}>
            {p.name}
          </button>
        ))}
        <button type="button" onClick={() => store.ask(null)} className={`${chip} border-line text-ink h-10 border-dashed px-1`}>
          {W.someoneElse}
        </button>
      </div>
      <SheetHost />
    </Frame>
  );
}
