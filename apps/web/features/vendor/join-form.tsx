'use client';

import { useState } from 'react';

import { t, type Language } from '@repo/shared/vendor';

const field = 'border-line bg-paper min-h-12 w-full rounded-[12px] border px-3 text-[16px]';

/** "Join as a vendor?" (D-102): a few plain questions; an admin reads it and the COO meets the shop. */
export function JoinForm({ lang, regions }: { lang: Language; regions: { id: string; name: string }[] }): React.JSX.Element {
  const [country, setCountry] = useState<'IN' | 'US'>('IN');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function send(form: FormData): Promise<void> {
    setState('busy');
    const value = (k: string): string | undefined => {
      const v = String(form.get(k) ?? '').trim();
      return v ? v : undefined;
    };
    const res = await fetch('/vendor/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        shop_name: value('shop_name'),
        owner_name: value('owner_name'),
        phone: value('phone'),
        country,
        region_id: country === 'IN' ? value('region_id') : undefined,
        city: value('city'),
        sells: value('sells'),
        language: lang,
      }),
    }).catch(() => null);
    setState(res?.ok ? 'done' : 'error');
  }

  if (state === 'done') return <p role="status" className="text-[18px] font-semibold">{t(lang, 'join_done')}</p>;

  return (
    <form action={(f) => void send(f)} className="space-y-3">
      <label className="block"><span className="mb-1 block text-[14px]">{t(lang, 'shop_name')}</span><input name="shop_name" required maxLength={120} className={field} /></label>
      <label className="block"><span className="mb-1 block text-[14px]">{t(lang, 'owner_name')}</span><input name="owner_name" required maxLength={120} className={field} /></label>
      <label className="block"><span className="mb-1 block text-[14px]">{t(lang, 'phone')}</span><input name="phone" required type="tel" inputMode="tel" pattern="\+?[0-9 ()\-]{6,24}" className={field} /></label>
      <fieldset>
        <legend className="mb-1 text-[14px]">{t(lang, 'country')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['IN', 'US'] as const).map((c) => (
            <button key={c} type="button" aria-pressed={country === c} onClick={() => setCountry(c)}
              className={`min-h-12 rounded-[12px] border text-[16px] font-semibold ${country === c ? 'border-brand bg-brand text-on-brand' : 'border-line bg-paper'}`}>
              {t(lang, c === 'IN' ? 'country_in' : 'country_us')}
            </button>
          ))}
        </div>
      </fieldset>
      {country === 'IN' ? (
        <label className="block">
          <span className="mb-1 block text-[14px]">{t(lang, 'region')}</span>
          <select name="region_id" required defaultValue="" className={field}>
            <option value="" disabled>—</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      ) : null}
      <label className="block"><span className="mb-1 block text-[14px]">{t(lang, 'city')}</span><input name="city" maxLength={120} className={field} /></label>
      <label className="block"><span className="mb-1 block text-[14px]">{t(lang, 'sells')}</span><textarea name="sells" rows={3} maxLength={1000} className={`${field} py-2`} /></label>
      <button disabled={state === 'busy'} className="bg-brand text-on-brand min-h-14 w-full rounded-[14px] text-[17px] font-semibold disabled:opacity-60">{t(lang, 'join_send')}</button>
      {state === 'error' ? <p role="alert" className="text-danger text-[15px] font-semibold">{t(lang, 'try_again')}</p> : null}
    </form>
  );
}
