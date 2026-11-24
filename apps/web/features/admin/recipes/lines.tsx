'use client';

import { useState, useTransition } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { findListingsAction, suggestMatchesAction, type Match } from '../actions/recipes';
import { input, linkButton, secondaryButton } from '../styles';

export interface EditorLine {
  key: string;
  id: string | null;
  label: string;
  amount: string;
  source: 'iwc' | 'local';
  variant_id: string | null;
  match_words: string;
  /** D-204: a swap for a fresh, local line ("Coriander"); empty for a main line. */
  instead_of: string;
  listing: { name: string; label: string; price_cents: number; health: string } | null;
}

const HEALTH: Record<string, string> = {
  ok: '',
  sold_out: ' · sold out',
  gone: ' · not live',
  unmatched: '',
};

const fromMatch = (m: Match): EditorLine['listing'] => ({
  name: m.product_name,
  label: m.variant_label,
  price_cents: m.price_cents,
  health: 'ok',
});

/**
 * The ingredients table (plan §4.4): ingredient, amount, IWC or Local, and for an IWC line the listing in the kit or
 * "Not on IWC yet · on the Blinkit pantry list". Match listings again suggests live, in-stock food options for every
 * line without one; Pick a listing searches by words. Changes are saved with the editor's Save.
 */
export function RecipeLines({
  recipeId,
  lines,
  onChange,
}: {
  recipeId: string | null;
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
}): React.JSX.Element {
  const [suggestions, setSuggestions] = useState<Record<string, Match[]>>({});
  const [picking, setPicking] = useState<string | null>(null);
  const [words, setWords] = useState('');
  const [found, setFound] = useState<Match[]>([]);
  const [pending, start] = useTransition();
  const set = (key: string, change: Partial<EditorLine>): void =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const choose = (key: string, m: Match): void => {
    set(key, { variant_id: m.variant_id, listing: fromMatch(m) });
    setPicking(null);
    setSuggestions((s) => ({ ...s, [key]: [] }));
  };

  return (
    <div className="space-y-3">
      {recipeId ? (
        <button
          type="button"
          className={secondaryButton}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const byId = await suggestMatchesAction(recipeId);
              const byKey: Record<string, Match[]> = {};
              for (const l of lines) if (l.id && byId[l.id]) byKey[l.key] = byId[l.id]!;
              setSuggestions(byKey);
            })
          }
        >
          {pending ? 'Matching…' : 'Match listings again'}
        </button>
      ) : null}
      <ul className="divide-line divide-y">
        {lines.map((l, i) => (
          <li key={l.key} className="space-y-2 py-3">
            <div className="grid grid-cols-[1fr_110px] gap-2 md:grid-cols-[1fr_120px_150px_auto]">
              <input
                className={input}
                value={l.label}
                maxLength={80}
                aria-label={`Ingredient ${i + 1}`}
                onChange={(e) => set(l.key, { label: e.target.value })}
              />
              <input
                className={input}
                value={l.amount}
                maxLength={40}
                aria-label={`Ingredient ${i + 1} amount`}
                placeholder="2 tbsp"
                onChange={(e) => set(l.key, { amount: e.target.value })}
              />
              <select
                className={input}
                value={l.source}
                aria-label={`Ingredient ${i + 1} from`}
                onChange={(e) =>
                  set(l.key, {
                    source: e.target.value as 'iwc' | 'local',
                    ...(e.target.value === 'local' ? { variant_id: null, listing: null } : {}),
                  })
                }
              >
                <option value="iwc">IWC (in the kit)</option>
                <option value="local">Local store</option>
              </select>
              <button
                type="button"
                className={`${linkButton} text-sm`}
                onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
              >
                Remove
              </button>
            </div>
            {l.source === 'iwc' ? (
              <div className="text-sm">
                {l.listing && l.variant_id ? (
                  <span className={l.listing.health === 'ok' ? '' : 'text-caution'}>
                    {l.listing.name} · {l.listing.label} · {formatUsd(l.listing.price_cents)}
                    {HEALTH[l.listing.health] ?? ''}
                  </span>
                ) : (
                  <span className="text-caution">
                    Not on IWC yet · customers see it as one to buy locally
                  </span>
                )}{' '}
                <button
                  type="button"
                  className={`${linkButton} ml-2`}
                  onClick={() => {
                    setPicking(picking === l.key ? null : l.key);
                    setWords(l.match_words || l.label.toLowerCase());
                    setFound([]);
                  }}
                >
                  {l.variant_id ? 'Change' : 'Pick a listing'}
                </button>
                <label className="text-ink-muted ml-3 inline-flex items-center gap-1 text-xs">
                  Match words
                  <input
                    className="border-line rounded border px-1.5 py-0.5"
                    value={l.match_words}
                    maxLength={120}
                    onChange={(e) => set(l.key, { match_words: e.target.value })}
                  />
                </label>
                <label
                  className="text-ink-muted ml-3 inline-flex items-center gap-1 text-xs"
                  title="A dry swap for a fresh ingredient: offered unticked, outside the kit's price"
                >
                  Swap for
                  <input
                    className="border-line w-28 rounded border px-1.5 py-0.5"
                    value={l.instead_of}
                    maxLength={80}
                    placeholder="(main line)"
                    onChange={(e) => set(l.key, { instead_of: e.target.value })}
                  />
                </label>
                {(suggestions[l.key] ?? []).length > 0 ? (
                  <MatchList matches={suggestions[l.key]!} onPick={(m) => choose(l.key, m)} />
                ) : null}
                {picking === l.key ? (
                  <div className="mt-2 space-y-2">
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        start(async () => setFound(await findListingsAction(words)));
                      }}
                    >
                      <input
                        className={input}
                        value={words}
                        onChange={(e) => setWords(e.target.value)}
                        aria-label="Search live food listings"
                      />
                      <button type="submit" className={secondaryButton} disabled={pending}>
                        Find
                      </button>
                    </form>
                    <MatchList matches={found} onPick={(m) => choose(l.key, m)} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={secondaryButton}
        onClick={() =>
          onChange([
            ...lines,
            {
              key: crypto.randomUUID(),
              id: null,
              label: '',
              amount: '',
              source: 'iwc',
              variant_id: null,
              match_words: '',
              instead_of: '',
              listing: null,
            },
          ])
        }
      >
        Add an ingredient
      </button>
    </div>
  );
}

function MatchList({
  matches,
  onPick,
}: {
  matches: Match[];
  onPick: (m: Match) => void;
}): React.JSX.Element | null {
  if (matches.length === 0) return null;
  return (
    <ul className="border-line mt-2 rounded-md border">
      {matches.map((m) => (
        <li
          key={m.variant_id}
          className="border-line flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
        >
          <span className="min-w-0 flex-1 truncate">
            {m.product_name} · {m.variant_label}
          </span>
          <span>{formatUsd(m.price_cents)}</span>
          <button type="button" className={`${linkButton} text-sm`} onClick={() => onPick(m)}>
            Use
          </button>
        </li>
      ))}
    </ul>
  );
}
