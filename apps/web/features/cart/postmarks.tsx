/**
 * Postmarks in the bag (the homesick plan's idea 8, D-161): "Your parcel carries 3 postmarks: Kerala, Punjab and
 * Gujarat.", one ring per state its pieces come from (their own state, as the line under each piece says; all-India
 * pieces carry none). Nothing for a bag without a state. No hooks, so the bag and checkout's summary both draw it.
 */
export function PostmarkLine({ names }: { names: (string | null | undefined)[] }): React.JSX.Element | null {
  const states = [...new Set(names.filter((n): n is string => Boolean(n)))];
  if (states.length === 0) return null;
  const list =
    states.length === 1 ? states[0] : `${states.slice(0, -1).join(', ')} and ${states[states.length - 1]}`;
  return (
    <p className="font-ui text-ink-muted m-0 flex items-center gap-2.5 text-[13px]">
      <span className="postmarks" aria-hidden="true">
        {states.slice(0, 3).map((s) => (
          <i key={s} />
        ))}
      </span>
      <span>
        Your parcel carries {states.length === 1 ? 'a postmark from' : `${states.length} postmarks:`}{' '}
        <span className="text-ink">{list}</span>.
      </span>
    </p>
  );
}
