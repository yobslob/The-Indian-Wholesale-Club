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
      <h1 className="text-ink text-2xl font-semibold">{title}</h1>
      <div className="text-ink space-y-3">{children}</div>
    </article>
  );
}

export function ComingSoon(): React.JSX.Element {
  return <p className="text-ink-muted">This page is being written.</p>;
}
