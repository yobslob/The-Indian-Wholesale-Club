'use client';

import { useEffect } from 'react';

import { formatInr, formatUsd, RELATION_NAMES, type Relation } from '@repo/shared/domain';

import { chip, picked, Thread, unpicked } from './card-bits';
import { deviceLovedOne, useGiftStore } from './gift-store';
import { SheetHost } from './sheet-host';
import { useSavingView } from './use-gift';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.card;
const FIRST: Relation[] = ['maa', 'papa', 'didi'];
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** The card's light frame (D-205 plan §4: only the border is wine in the bag), with a line sewn 5 px inside it. */
function Frame({ children, label }: { children: React.ReactNode; label: string }): React.JSX.Element {
  return (
    <section aria-label={label} className="bg-paper border-brand relative rounded-[20px] border-[1.5px] p-4">
      <span aria-hidden="true" className="border-brand/35 pointer-events-none absolute inset-[5px] rounded-[15px] border border-dashed" />
      {children}
    </section>
  );
}

/**
 * D-208, the bag's card for the 5% saving, in D-205's look: "You're saving $4.25 on this bag.", the dollars sewn to the
 * rupees, and one choice: Maa · Papa · Didi · Someone else (sent home by IWC after payment) or Keep it (Coins, the
 * default). A returning sender starts on their last loved one. The customer pays the same either way: nothing joins the
 * bill. While Send home is closed the card only says the saving goes into Coins.
 */
export function SendHomeCard({ goodsCents }: { goodsCents: number | null }): React.JSX.Element | null {
  const view = useSavingView(goodsCents);
  const store = useGiftStore();

  // the first look at this bag starts on the last person sent to, else on Keep it
  useEffect(() => {
    if (!view || store.started) return;
    const saved = view.settings.loved_ones[0]?.id ?? null;
    store.start(saved, saved ? null : deviceLovedOne());
  }, [view, store]);
  // the sheet shows the saving's rupees
  useEffect(() => {
    if (view && view.cents !== store.cents) store.setCents(view.cents);
  }, [view, store]);

  if (!view) return null;
  const usd = formatUsd(view.cents);
  const inr = view.inrPaise === null ? null : formatInr(view.inrPaise);
  const person = view.person;
  const saved = view.settings.loved_ones;
  const people: { key: string; name: string; on: boolean; pick: () => void }[] =
    saved.length > 0 || store.lovedOne
      ? [
          ...saved.slice(0, 3).map((l) => ({ key: l.id, name: l.call_name, on: l.id === person?.savedId, pick: () => store.pickSaved(l.id) })),
          ...(store.lovedOne
            ? [{ key: 'typed', name: store.lovedOne.callName, on: person !== null && person.savedId === null, pick: () => store.pickTyped(store.lovedOne!, store.save) }]
            : []),
        ].slice(0, 3)
      : FIRST.map((r) => ({ key: r, name: RELATION_NAMES[r], on: false, pick: () => store.ask(r) }));
  const last = person?.savedId ? saved.find((l) => l.id === person.savedId) : null;

  return (
    <Frame label={W.kicker}>
      <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{W.kicker}</p>
      <h2 className="font-heading text-ink m-0 text-[16px] font-semibold leading-tight">{W.head(usd)}</h2>
      {inr ? (
        <p className="font-ui text-ink mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <b className="text-[15px]">{usd}</b>
          <Thread />
          <b className="font-display text-[22px] font-medium leading-none">{inr}</b>
        </p>
      ) : null}
      <p className="font-ui text-ink-muted mt-1.5 text-[12.5px]">
        {!inr ? W.closed : person ? W.to(inr, person.name) : W.ask(inr)}
        {last?.last_inr_paise && last.last_at ? ` ${W.lastTime(formatInr(last.last_inr_paise), day.format(new Date(last.last_at)))}` : ''}
      </p>
      {inr ? (
        <div className="border-line mt-3 grid grid-cols-4 gap-1.5 border-t border-dashed pt-3" aria-label={W.whoChips} role="group">
          {people.map((p) => (
            <button key={p.key} type="button" onClick={p.pick} aria-pressed={p.on} className={`${chip} h-10 truncate px-1 ${p.on ? picked : unpicked}`}>
              {p.name}
            </button>
          ))}
          <button type="button" onClick={() => store.ask(null)} className={`${chip} border-line text-ink h-10 border-dashed px-1`}>
            {W.someoneElse}
          </button>
          <button
            type="button"
            onClick={store.keepIt}
            aria-pressed={person === null}
            className={`${chip} col-span-4 h-10 ${person === null ? picked : unpicked}`}
          >
            {W.keep}
          </button>
        </div>
      ) : null}
      <SheetHost />
    </Frame>
  );
}
