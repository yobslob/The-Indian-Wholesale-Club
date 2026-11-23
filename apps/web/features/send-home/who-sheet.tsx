'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

import { formatInr, giftInrPaise, GIFT_LINE_MAX, giftLineOf, RELATION_NAMES, upiOf, type Relation } from '@repo/shared/domain';

import { rememberOnDevice, useGiftStore } from './gift-store';
import { forgetSendHome, sendHomeNow } from './settings';
import { SEND_HOME_WORDS } from './words';

const W = SEND_HOME_WORDS.sheet;
const CHIPS: Relation[] = ['maa', 'papa', 'dadi', 'nani', 'dada', 'nana', 'bhaiya', 'didi', 'other'];
const field = 'border-line bg-paper text-ink h-11 w-full rounded-[10px] border px-3 text-[15px]';
const label = 'font-ui text-ink grid gap-1 text-[13px] font-semibold';
const hint = 'font-ui text-ink-muted text-[12px] font-normal';

/**
 * D-205, "Who's it for?" (plan §4.2): a bottom sheet on phones, a dialog on wide screens. Rupees only, never dollars
 * (the founder). The relation chips fill the name the customer calls them, which they can change; the UPI is checked as
 * typed; "Remove the gift and continue" is always there, so payment never opens with an unnamed gift.
 */
export function WhoSheet({ relation, then }: { relation: Relation | null; then: 'checkout' | null }): React.JSX.Element {
  const router = useRouter();
  const store = useGiftStore();
  const settings = sendHomeNow();
  const id = useId();
  const typed = store.lovedOne;
  const [rel, setRel] = useState<Relation | null>(relation ?? typed?.relation ?? null);
  const [name, setName] = useState(relation ? RELATION_NAMES[relation] : (typed?.callName ?? ''));
  const [upi, setUpi] = useState(typed && (relation === null || typed.relation === relation) ? typed.upi : '');
  const [upiTouched, setUpiTouched] = useState(false);
  const [regionId, setRegionId] = useState(typed?.regionId ?? '');
  const [line, setLine] = useState(typed?.note ?? '');
  const [remember, setRemember] = useState(true);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const first = useRef<HTMLButtonElement>(null);
  const inr = formatInr(giftInrPaise(store.cents, settings?.inr_per_usd ?? null) ?? 0);
  const upiOk = upiOf(upi) !== null;
  const signedIn = settings?.signed_in ?? false;

  useEffect(() => {
    first.current?.focus();
    void fetch('/api/send-home?regions')
      .then((r) => r.json() as Promise<{ regions?: { id: string; name: string }[] }>)
      .then((b) => setRegions(b.regions ?? []))
      .catch(() => setRegions([]));
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') store.close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const finish = (): void => {
    store.close();
    if (then === 'checkout') router.push('/checkout');
  };

  function send(e: React.FormEvent): void {
    e.preventDefault();
    const parsed = upiOf(upi);
    if (!parsed || !name.trim()) {
      setUpiTouched(true);
      return;
    }
    const one = {
      relation: rel ?? 'other',
      callName: name.trim().slice(0, 20),
      upi: parsed.value,
      regionId: regionId || null,
      regionName: regions.find((r) => r.id === regionId)?.name ?? null,
      note: giftLineOf(line),
    };
    store.pickTyped(one, signedIn && remember);
    // rule 6: a guest's loved one is kept on this device only, and only when asked
    if (!signedIn) rememberOnDevice(remember ? one : null);
    else if (remember) forgetSendHome();
    finish();
  }

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[rgba(30,27,22,0.45)] min-[640px]:place-items-center" onClick={store.close}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onSubmit={send}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] p-5 pb-[max(20px,env(safe-area-inset-bottom))] min-[640px]:max-w-[440px] min-[640px]:rounded-[22px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-ui text-ink-muted m-0 text-[10px] font-bold uppercase tracking-[0.14em]">{W.kicker(inr)}</p>
            <h2 id={`${id}-t`} className="font-heading text-ink m-0 text-[20px] font-semibold">
              {W.title}
            </h2>
          </div>
          <button type="button" onClick={store.close} aria-label={W.close} className="text-ink-muted -mr-2 -mt-1 grid h-11 w-11 place-items-center text-[22px]">
            ×
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={W.callName}>
          {CHIPS.map((r, n) => (
            <button
              key={r}
              ref={n === 0 ? first : undefined}
              type="button"
              role="radio"
              aria-checked={rel === r}
              onClick={() => {
                setRel(r);
                setName(RELATION_NAMES[r]);
              }}
              className={`font-ui h-10 rounded-pill border px-3.5 text-[14px] font-semibold ${rel === r ? 'border-brand bg-canvas border-[1.5px]' : 'border-line'} ${r === 'other' ? 'border-dashed' : ''}`}
            >
              {r === 'other' ? SEND_HOME_WORDS.card.someoneElse : RELATION_NAMES[r]}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3.5">
          <label className={label}>
            {W.callName}
            <input className={field} value={name} maxLength={20} required onChange={(e) => setName(e.target.value)} autoComplete="off" />
            {name.trim() ? <span className={hint}>{W.callNameHint(name.trim())}</span> : null}
          </label>
          <label className={label}>
            {W.upi}
            <input
              className={field}
              value={upi}
              required
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={upiTouched && !upiOk}
              aria-describedby={`${id}-u`}
              onBlur={() => setUpiTouched(true)}
              onChange={(e) => setUpi(e.target.value)}
            />
            <span id={`${id}-u`} className={upiTouched && !upiOk ? 'font-ui text-danger text-[12px] font-normal' : hint}>
              {upiTouched && !upiOk ? W.upiBad : W.upiHint}
            </span>
          </label>
          <label className={label}>
            {W.region}
            <select className={field} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">{W.regionNone}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            {W.line}
            <input className={field} value={line} maxLength={GIFT_LINE_MAX} onChange={(e) => setLine(e.target.value)} autoComplete="off" />
            <span className={hint}>
              {W.lineHint} {line.length}/{GIFT_LINE_MAX}
            </span>
          </label>
          <label className="font-ui text-ink flex min-h-11 items-center gap-2.5 text-[14px]">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-brand h-5 w-5" />
            <span>
              {W.remember(name.trim())}
              {!signedIn ? <span className={`${hint} block`}>{W.rememberGuest}</span> : null}
            </span>
          </label>
        </div>
        <button type="submit" className="bg-brand text-on-brand font-ui mt-4 h-[52px] w-full rounded-pill text-base font-semibold">
          {W.send(inr, name.trim())}
        </button>
        <button
          type="button"
          onClick={() => {
            store.setRemoved(true);
            finish();
          }}
          className="font-ui text-ink mt-2 min-h-11 w-full text-[14px] font-medium underline underline-offset-[3px]"
        >
          {W.removeAndGo}
        </button>
      </form>
    </div>
  );
}
