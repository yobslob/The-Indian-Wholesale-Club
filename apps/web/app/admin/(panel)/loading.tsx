/** Shown at once when an admin page is opened, inside the frame, until the page's first part is ready. */
export default function AdminPageLoading(): React.JSX.Element {
  return (
    <div className="space-y-4" aria-busy="true">
      <p className="text-ink-muted text-sm" role="status">
        Loading…
      </p>
      <div className="bg-line/50 h-9 w-48 animate-pulse rounded-lg" />
      <div className="bg-line/40 h-64 animate-pulse rounded-xl" />
    </div>
  );
}
