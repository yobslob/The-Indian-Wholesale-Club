'use client';

import { browseHref, WHO, WHO_LABEL, withFilter, type BrowseQuery, type Who } from './browse-query';

/**
 * /clothing's two large tiles (D-140, plan F2): Women and Men, with how many pieces each has in view; the chosen one in
 * ink, a second tap shows everyone again. Unisex pieces count under both; no Kids at launch (founder). Real links
 * (new tabs, no JavaScript); a plain click filters in place.
 */
export function WhoTiles({
  query,
  counts,
  onChange,
}: {
  query: BrowseQuery;
  counts: Record<Who, number>;
  onChange: (next: BrowseQuery) => void;
}): React.JSX.Element {
  return (
    <nav aria-label="Clothing for" className="grid grid-cols-2 gap-[var(--gap)]">
      {WHO.filter((w) => counts[w] > 0 || query.who === w).map((w) => {
        const on = query.who === w;
        const next = withFilter(query, { who: on ? undefined : w });
        return (
          <a
            key={w}
            href={browseHref('clothing', next)}
            aria-current={on ? 'true' : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onChange(next);
            }}
            className={`press group flex min-h-[clamp(88px,9vw,132px)] flex-col items-start justify-end gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3 rounded-lg border px-[clamp(16px,2vw,28px)] py-[clamp(14px,1.6vw,22px)] transition-colors ${
              on ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink hover:border-ink'
            }`}
          >
            <span className="font-display text-[clamp(24px,2.6vw,40px)] leading-none">{WHO_LABEL[w]}</span>
            <span className={`font-ui whitespace-nowrap text-sm ${on ? 'text-paper/80' : 'text-ink-muted'}`}>
              {counts[w]} {counts[w] === 1 ? 'piece' : 'pieces'}
              <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-300 group-hover:translate-x-1">
                →
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
