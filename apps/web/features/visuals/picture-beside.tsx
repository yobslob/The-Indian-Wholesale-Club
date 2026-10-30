import { type SlotId } from './slots';
import { slotShown, VisualSlot } from './visual-slot';

/**
 * A page's one narrow column with one of the founder's pictures in the empty space beside it (founder 2026-10-31:
 * "think creatively of what we can put in the whitespaces available"). Wide screens only: on a phone the column already
 * fills the width, so the picture would only push the page down. An empty slot on the live site draws nothing and the
 * column stands as before. Server-only (the slot reads which build this is).
 */
export function PictureBeside({
  id,
  children,
}: {
  id: SlotId;
  children: React.ReactNode;
}): React.JSX.Element {
  if (!slotShown(id)) return <>{children}</>;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)] lg:items-start lg:gap-[clamp(40px,5vw,96px)]">
      <div className="min-w-0">{children}</div>
      <div className="hidden lg:block lg:sticky lg:top-[calc(var(--top-h)+24px)]">
        <VisualSlot id={id} className="max-h-[calc(100svh-var(--top-h)-48px)]" />
      </div>
    </div>
  );
}
