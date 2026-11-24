'use client';

import { useEffect } from 'react';

import { formatInr, formatUsd, RELATION_NAMES, upiOwnerWord, type Relation } from '@repo/shared/domain';

import { deviceLovedOne, useGiftStore } from './gift-store';
import { SheetHost } from './sheet-host';
import { useSavingView, type SavingView } from './use-gift';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.card;
const FIRST: Relation[] = ['maa', 'papa', 'didi'];
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const coinsOf = (cents: number): string => cents.toLocaleString('en-US');

/** The card's light frame (D-205 plan §4: only the border is wine in the bag), with a line sewn 5 px inside it. */
function Frame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-label={W.kicker} className="bg-paper border-brand relative rounded-[20px] border-[1.5px] px-3.5 pb-3.5 pt-4">
      <span aria-hidden="true" className="border-brand/30 pointer-events-none absolute inset-[5px] rounded-[15px] border border-dashed" />
      <div className="relative">{children}</div>
    </section>
  );
}

/** A radio's dot: filled ink when picked. */
function Dot({ on }: { on: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`bg-paper box-border h-5 w-5 shrink-0 rounded-full ${on ? 'border-ink border-[6px]' : 'border-[1.5px] border-[#B5A994]'}`}
    />
  );
}

const rowFrame = (on: boolean): string => `rounded-[14px] ${on ? 'border-brand bg-canvas border-[1.5px]' : 'border-line bg-paper border'}`;
const pill = 'font-ui text-ink grid h-10 place-items-center rounded-pill px-1 text-[13px]';
const rowButton = 'font-ui text-ink flex min-h-[60px] w-full items-center gap-3 px-3 py-2.5 text-left';

/** Who can be picked: the saved loved ones (or the one typed for this bag), else Maa, Papa and Didi, which open the sheet. */
function useWho(view: SavingView): { key: string; name: string; on: boolean; pick: () => void }[] {
  const store = useGiftStore();
  const person = view.person;
  const saved = view.settings.loved_ones;
  if (saved.length === 0 && !store.lovedOne)
    return FIRST.map((r) => ({ key: r, name: RELATION_NAMES[r], on: false, pick: () => store.ask(r) }));
  return [
    ...saved.slice(0, 3).map((l) => ({ key: l.id, name: l.call_name, on: l.id === person?.savedId, pick: () => store.pickSaved(l.id) })),
    ...(store.lovedOne
      ? [{ key: 'typed', name: store.lovedOne.callName, on: person !== null && person.savedId === null, pick: () => store.pickTyped(store.lovedOne!, store.save) }]
      : []),
  ].slice(0, 3);
}

/**
 * D-208, D-211: the bag's card for the 5% saving. It says what it is ("You get $1.10 back", paid by IWC, the total
 * unchanged) and asks one question with two answers, each with its amount: Keep it (Coins) or Send it home (rupees, by
 * UPI after payment). The bag starts on Send it home: a returning sender on their last loved one. The names show only
 * while Send it home is picked. The customer pays the same either way: nothing joins the bill's sum. While Send home is
 * closed the card only says the saving goes into Coins.
 */
export function SendHomeCard({ goodsCents }: { goodsCents: number | null }): React.JSX.Element | null {
  const view = useSavingView(goodsCents);
  const store = useGiftStore();

  // the first look at this bag starts on Send it home, with the last person sent to when there is one (D-211)
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
  return <CardBody view={view} />;
}

function CardBody({ view }: { view: SavingView }): React.JSX.Element {
  const store = useGiftStore();
  const who = useWho(view);
  const usd = formatUsd(view.cents);
  const inr = view.inrPaise === null ? null : formatInr(view.inrPaise);
  const { person, sending } = view;
  const last = person?.savedId ? view.settings.loved_ones.find((l) => l.id === person.savedId) : null;
  const sendSub = !person
    ? W.sendSub
    : last?.last_inr_paise && last.last_at
      ? W.sendSubLast(upiOwnerWord(person.relation), formatInr(last.last_inr_paise), day.format(new Date(last.last_at)))
      : W.sendSubTo(person.name);

  return (
    <Frame>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="border-gift-thread font-display grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] text-[14px] font-bold">
          5%
        </span>
        <div>
          <h2 className="font-heading text-ink m-0 text-[17px] font-bold leading-tight">{W.head(usd)}</h2>
          <p className="font-ui text-ink-muted m-0 mt-0.5 text-[12.5px] leading-snug">{inr ? W.sub : W.closed}</p>
        </div>
      </div>
      {inr ? (
        <div role="radiogroup" aria-label={W.question} className="mt-3.5 grid gap-2">
          <p className="font-ui text-ink m-0 mb-0.5 text-[13px] font-bold">{W.question}</p>
          <div className={rowFrame(!sending)}>
            <button type="button" role="radio" aria-checked={!sending} onClick={store.keepIt} className={rowButton}>
              <Dot on={!sending} />
              <span className="flex-1">
                <span className="block text-[15px] font-bold">{W.keep}</span>
                <span className="text-ink-muted mt-px block text-[12.5px]">{W.keepSub(coinsOf(view.cents))}</span>
              </span>
              <span className="text-[15px] font-bold">{usd}</span>
            </button>
          </div>
          <div className={rowFrame(sending)}>
            <button type="button" role="radio" aria-checked={sending} onClick={store.sendIt} className={rowButton}>
              <Dot on={sending} />
              <span className="flex-1">
                <span className="block text-[15px] font-bold">{sending && person ? W.sendTo(person.name) : W.send}</span>
                <span className="text-ink-muted mt-px block text-[12.5px]">{sending ? sendSub : W.sendSub}</span>
              </span>
              <span className="font-display text-[18px] font-bold">{inr}</span>
            </button>
            {sending ? (
              <div className="rise-in px-3 pb-3 pl-[44px]">
                <p className="font-ui text-ink-muted m-0 mb-1.5 text-[12px] font-bold">{W.to}</p>
                <div role="group" aria-label={W.whoChips} className="grid grid-cols-4 gap-1.5">
                  {who.map((p) => (
                    <button key={p.key} type="button" onClick={p.pick} aria-pressed={p.on} className={`${pill} truncate ${p.on ? 'border-brand bg-canvas border-[1.5px] font-bold' : 'border-line bg-paper border font-medium'}`}>
                      {p.name}
                    </button>
                  ))}
                  <button type="button" onClick={() => store.ask(null)} className={`${pill} bg-paper border border-dashed border-[#B5A994] text-[12px] font-medium leading-tight`}>
                    {W.someoneElse}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <SheetHost />
    </Frame>
  );
}
