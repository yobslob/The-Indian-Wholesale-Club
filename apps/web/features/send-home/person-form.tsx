'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';

import { GIFT_LINE_MAX, RELATION_NAMES, RELATIONS, type Relation } from '@repo/shared/domain';

import { saveLovedOneAction, type PeopleState } from './people-actions';
import { forgetSendHome } from './settings';
import { UpiCheck } from './upi-check';
import { SEND_HOME_WORDS } from './words';

import type { MyPeople } from '@repo/db/store';

const W = SEND_HOME_WORDS;
const input = 'border-line bg-paper focus:border-ink mt-1.5 block min-h-12 w-full rounded-md border px-3.5 text-[15px] font-normal outline-none';
const field = 'font-ui block text-[13px] font-medium';

type Person = NonNullable<MyPeople>['loved_ones'][number];

/**
 * D-205 §4.7: add or edit someone at home. The UPI is checked as it is typed (D-206); when editing, an empty UPI field
 * keeps the one saved (the customer only ever sees it masked).
 */
export function PersonForm({ person, regions }: { person?: Person; regions: { id: string; name: string }[] }): React.JSX.Element {
  const router = useRouter();
  const [state, action, pending] = useActionState<PeopleState, FormData>(saveLovedOneAction.bind(null, person?.id ?? null), {
    error: null,
  });
  // saved: back to the list (the page was opened with ?add or ?edit), and the bag reads the people again
  useEffect(() => {
    if (!state.done) return;
    forgetSendHome();
    router.replace('/account/people');
  }, [state, router]);
  const [relation, setRelation] = useState<Relation>(person?.relation ?? 'maa');
  const [name, setName] = useState(person?.call_name ?? RELATION_NAMES.maa);
  const [upi, setUpi] = useState('');
  return (
    <form action={action} className="bg-surface grid max-w-xl gap-4 rounded-lg p-[clamp(18px,2vw,28px)]">
      <h3 className="font-heading m-0 text-xl font-medium text-[#1D1A17]">{person ? W.people.edit : W.people.add}</h3>
      <label className={field}>
        {W.people.relation}
        <select
          name="relation"
          value={relation}
          onChange={(e) => {
            const r = e.target.value as Relation;
            setRelation(r);
            if (r !== 'other') setName(RELATION_NAMES[r]);
          }}
          className={input}
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r}>
              {r === 'other' ? W.card.someoneElse : RELATION_NAMES[r]}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {W.sheet.callName}
        <input name="callName" required maxLength={20} value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <label className={field}>
        {W.sheet.upi}
        <input
          name="upi"
          required={!person}
          value={upi}
          placeholder={person ? person.upi_masked : ''}
          onChange={(e) => setUpi(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={input}
        />
        {upi || !person ? <UpiCheck value={upi} touched={upi.length > 3} /> : <span className="font-ui text-ink-muted text-[12px]">{W.people.keepUpi}</span>}
      </label>
      <label className={field}>
        {W.sheet.region}
        <select name="regionId" defaultValue={person?.region_id ?? ''} className={input}>
          <option value="">{W.sheet.regionNone}</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className={field}>
        {W.sheet.line}
        <input name="note" maxLength={GIFT_LINE_MAX} defaultValue={person?.note ?? ''} className={input} />
      </label>
      {state.error ? (
        <p role="alert" className="font-ui text-danger m-0 text-sm">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="bg-brand text-on-brand font-ui rounded-pill min-h-12 px-6 text-[15px] font-medium">
        {pending ? 'Saving…' : W.people.save}
      </button>
    </form>
  );
}
