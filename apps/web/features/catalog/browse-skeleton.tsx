/**
 * What a See all page shows the moment its link is tapped, while the page comes (loading.tsx; founder 2026-10-24: "when
 * I click on a category it waits for a long time"). The page's own shape, so nothing jumps when it arrives: a heading,
 * the filter column from 1024 px, the cards' grid (three to a row on phones for food and home, as `data-dense` draws
 * them), and the brand's running stitch along the top (D-140). Server-rendered, no JavaScript; still for reduced motion.
 */
export function BrowseSkeleton({ dense = true }: { dense?: boolean }): React.JSX.Element {
  const block = 'bg-land/70 motion-safe:animate-pulse rounded-lg';
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span role="progressbar" aria-label="Loading" className="stitch-loading" />
      <span className="sr-only">Loading the pieces…</span>
      <div className={`${block} h-11 w-[min(100%,340px)] rounded-full`} />
      <div className={`${block} h-[clamp(40px,4vw,64px)] w-[min(70%,360px)]`} />
      <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-[clamp(28px,3vw,52px)]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className={`${block} h-9`} style={{ width: `${88 - ((i * 13) % 40)}%` }} />
          ))}
        </div>
        <div
          data-card-grid=""
          data-dense={dense ? '' : undefined}
          className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-[clamp(28px,3vw,44px)] lg:grid-cols-3 2xl:grid-cols-4"
        >
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className={`${block} aspect-[4/5]`} />
              <div className={`${block} h-4 w-4/5`} />
              <div className={`${block} h-4 w-2/5`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
