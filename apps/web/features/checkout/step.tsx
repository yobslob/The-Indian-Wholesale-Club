/** One checkout step (D-087): its number and title; open, it shows its body; done, it folds to a summary and Edit. */
export function Step({
  n,
  title,
  state,
  summary,
  onEdit,
  children,
}: {
  n: number;
  title: string;
  state: 'open' | 'done' | 'later';
  summary?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}): React.JSX.Element {
  const dot =
    state === 'open' ? 'bg-ink text-paper' : state === 'done' ? 'bg-positive text-white' : 'bg-surface text-ink-muted';
  return (
    <section className="border-line border-t py-[18px] last:border-b" aria-labelledby={`step-${n}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`font-ui grid size-7 flex-none place-items-center rounded-full text-[13px] font-semibold ${dot}`} aria-hidden="true">
          {state === 'done' ? '✓' : n}
        </span>
        <h2 id={`step-${n}`} className={`font-heading m-0 text-xl font-medium leading-tight ${state === 'later' ? 'text-ink-muted' : 'text-[#1D1A17]'} ${state === 'done' ? '' : 'flex-1'}`}>
          {title}
        </h2>
        {state === 'done' ? (
          <>
            <span className="text-ink-muted hidden min-w-0 flex-1 truncate text-sm sm:block">{summary}</span>
            <button
              type="button"
              onClick={onEdit}
              className="border-line bg-paper font-ui ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-medium"
              aria-label={`Edit ${title.toLowerCase()}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[15px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h4L19 9l-4-4L4 16z" />
                <path d="m13.5 6.5 4 4" />
              </svg>
              Edit
            </button>
            <p className="text-ink-muted m-0 basis-full pl-10 text-sm sm:hidden">{summary}</p>
          </>
        ) : null}
      </div>
      {state === 'open' ? <div className="pb-1 pt-[18px] sm:pl-10">{children}</div> : null}
    </section>
  );
}

export const field = 'font-ui mb-3.5 block text-[13px] font-medium';
export const input =
  'border-line bg-paper focus:border-ink mt-1.5 block min-h-12 w-full rounded-md border px-3.5 text-[15px] font-normal outline-none';
export const primary =
  'bg-brand text-on-brand font-ui inline-grid min-h-[52px] place-items-center rounded-pill px-7 text-base font-semibold disabled:opacity-50';
export const note = 'text-ink-muted mt-3 text-[13px]';
