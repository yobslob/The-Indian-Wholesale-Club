'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { formatUsd, kitTotal } from '@repo/shared/domain';

import { saveRecipeAction, type RecipeForm } from '../actions/recipes';
import { button, input, linkButton, panel, secondaryButton } from '../styles';

import { RecipeLines, type EditorLine } from './lines';
import { RecipePhotosByName } from './photos-by-name';

export type { EditorLine };

type Fields = Omit<RecipeForm, 'lines'> & { lines: EditorLine[] };

const EMPTY: Fields = {
  slug: '',
  name: '',
  region_id: null,
  kind: 'dinner',
  blurb: '',
  minutes: 30,
  soak_hours: null,
  serves: 4,
  effort: 'easy',
  steps: [{ text: '', minutes: null }],
  sort: 1000,
  lines: [],
};

const label = 'font-ui text-[13px] font-semibold';
const num = (v: string): number => (v === '' ? 0 : Number(v));

/**
 * The recipe's words, kit and steps (D-203, plan §4.4). One Save writes the fields and every line; the words stay a
 * draft until approved in the strip above, and a recipe goes live only through Publish.
 */
export function RecipeEditor({
  recipeId,
  regions,
  initial,
  photo = null,
}: {
  recipeId: string | null;
  regions: { id: string; name: string }[];
  initial: Fields | null;
  photo?: { url: string; path: string } | null;
}): React.JSX.Element {
  const router = useRouter();
  const [f, setF] = useState<Fields>(initial ?? EMPTY);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const set = (change: Partial<Fields>): void => setF((x) => ({ ...x, ...change }));
  const kit = kitTotal(
    f.lines
      .filter((l) => l.source === 'iwc')
      .map((l) => ({
        variantId: l.variant_id,
        priceCents: l.listing?.price_cents ?? null,
        available: l.listing?.health === 'ok',
      })),
  );

  const save = (): void =>
    start(async () => {
      const r = await saveRecipeAction(recipeId, {
        ...f,
        steps: f.steps.filter((s) => s.text.trim()),
        lines: f.lines.map(({ label: l, amount, source, variant_id, match_words, instead_of }) => ({
          label: l,
          amount,
          source,
          variant_id,
          match_words,
          instead_of: source === 'iwc' && instead_of.trim() ? instead_of.trim() : null,
        })),
      });
      if (r.error) return setMessage({ error: true, text: r.error });
      setMessage({ error: false, text: 'Saved.' });
      if (!recipeId && r.id) router.push(`/admin/recipes/${r.id}`);
      else router.refresh();
    });

  return (
    <div className="space-y-5">
      <section className={`${panel} grid gap-3 md:grid-cols-2`}>
        {recipeId ? (
          <div className="space-y-2 md:col-span-2">
            <span className={label}>Photo</span>
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- the admin's own preview */}
                <img
                  src={photo.url}
                  alt=""
                  className="bg-surface size-20 rounded-md object-cover"
                />
                <span className="text-ink-muted break-all text-xs">{photo.path}</span>
              </div>
            ) : (
              <p className="text-caution text-sm">No photo yet.</p>
            )}
            <RecipePhotosByName recipeId={recipeId} />
          </div>
        ) : null}
        <label className="space-y-1">
          <span className={label}>Name</span>
          <input
            className={input}
            value={f.name}
            maxLength={80}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Address (slug, also the photo&rsquo;s file name)</span>
          <input
            className={input}
            value={f.slug}
            maxLength={80}
            onChange={(e) => set({ slug: e.target.value.toLowerCase() })}
          />
        </label>
        <label className="space-y-1">
          <span className={label}>State</span>
          <select
            className={input}
            value={f.region_id ?? ''}
            onChange={(e) => set({ region_id: e.target.value || null })}
          >
            <option value="">All of India</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={label}>Kind</span>
          <select
            className={input}
            value={f.kind}
            onChange={(e) => set({ kind: e.target.value as Fields['kind'] })}
          >
            <option value="snacks">Snacks</option>
            <option value="breakfast">Breakfast</option>
            <option value="dinner">Dinner</option>
            <option value="sweets">Sweets</option>
            <option value="drinks">Chai &amp; drinks</option>
          </select>
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>The one line ({f.blurb.length}/200)</span>
          <input
            className={input}
            value={f.blurb}
            maxLength={200}
            onChange={(e) => set({ blurb: e.target.value })}
          />
        </label>
        <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-5">
          <label className="space-y-1">
            <span className={label}>Minutes</span>
            <input
              className={input}
              type="number"
              min={1}
              value={f.minutes}
              onChange={(e) => set({ minutes: num(e.target.value) })}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Soak hours</span>
            <input
              className={input}
              type="number"
              min={0}
              step={0.5}
              value={f.soak_hours ?? ''}
              onChange={(e) =>
                set({ soak_hours: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Serves</span>
            <input
              className={input}
              type="number"
              min={1}
              value={f.serves}
              onChange={(e) => set({ serves: num(e.target.value) })}
            />
          </label>
          <label className="space-y-1">
            <span className={label}>Effort</span>
            <select
              className={input}
              value={f.effort}
              onChange={(e) => set({ effort: e.target.value as Fields['effort'] })}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="weekend">Weekend</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className={label}>Shelf order</span>
            <input
              className={input}
              type="number"
              min={0}
              value={f.sort}
              onChange={(e) => set({ sort: num(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className={`${panel} space-y-3`}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-heading text-[15px] font-semibold">Ingredients</h2>
          <span className="text-ink-muted text-sm">
            Kit: {kit.count} pieces · {formatUsd(kit.cents)}
            {kit.cents > 0 ? <s className="ml-1">{formatUsd(kit.wasCents)}</s> : null}
          </span>
        </div>
        <RecipeLines recipeId={recipeId} lines={f.lines} onChange={(lines) => set({ lines })} />
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">Method</h2>
        <ol className="space-y-2">
          {f.steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[24px_1fr_80px_auto] items-start gap-2">
              <span className="pt-2.5 text-sm font-semibold">{i + 1}</span>
              <textarea
                className={`${input} h-auto min-h-[64px] py-2`}
                value={s.text}
                maxLength={600}
                aria-label={`Step ${i + 1}`}
                onChange={(e) =>
                  set({
                    steps: f.steps.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)),
                  })
                }
              />
              <input
                className={input}
                type="number"
                min={0}
                placeholder="min"
                aria-label={`Step ${i + 1} minutes`}
                value={s.minutes ?? ''}
                onChange={(e) =>
                  set({
                    steps: f.steps.map((x, k) =>
                      k === i
                        ? { ...x, minutes: e.target.value === '' ? null : Number(e.target.value) }
                        : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className={`${linkButton} text-sm`}
                onClick={() => set({ steps: f.steps.filter((_, k) => k !== i) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className={secondaryButton}
          onClick={() => set({ steps: [...f.steps, { text: '', minutes: null }] })}
        >
          Add a step
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={button} disabled={pending} onClick={save}>
          {pending ? 'Saving…' : recipeId ? 'Save' : 'Create the recipe'}
        </button>
        {message ? (
          <span
            role="status"
            className={message.error ? 'text-danger text-sm' : 'text-positive text-sm'}
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
