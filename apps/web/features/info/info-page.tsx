/** Shared shell for the static info pages (storefront.md). Policy text needs founder input. */
export function InfoPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <article className="max-w-2xl space-y-4">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">{title}</h1>
      <div className="text-ink space-y-3">{children}</div>
    </article>
  );
}

export function ComingSoon(): React.JSX.Element {
  return <p className="text-ink-muted">This page is being written.</p>;
}
