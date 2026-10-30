import { PictureBeside } from '@/features/visuals/picture-beside';

import type { SlotId } from '@/features/visuals/slots';

/**
 * Shared shell for the static info pages (storefront.md). Policy text needs founder input. `picture`: one of the
 * founder's pictures in the empty space beside the text on wide screens (picture-beside.tsx); the glass panel (D-092)
 * shows the text alone.
 */
export function InfoPage({
  title,
  picture,
  children,
}: {
  title: string;
  picture?: SlotId;
  children: React.ReactNode;
}): React.JSX.Element {
  const article = (
    <article className="max-w-2xl space-y-4">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">{title}</h1>
      <div className="text-ink space-y-3">{children}</div>
    </article>
  );
  return picture ? <PictureBeside id={picture}>{article}</PictureBeside> : article;
}
