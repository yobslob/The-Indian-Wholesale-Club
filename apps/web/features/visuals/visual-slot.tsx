import { SLOTS, type Slot, type SlotId } from './slots';

/** Placeholders show outside the live site only (local `next dev`, Vercel previews). */
const SHOW_EMPTY = process.env.VERCEL_ENV !== 'production';

/**
 * One of the founder's pictures (slots.ts): a static file at its own size, no resizer (D-140), lazy unless `eager`.
 * While the slot is empty: a labelled frame off the live site, nothing on it (the page is laid out to stand without it).
 */
export function VisualSlot({
  id,
  className = '',
  eager = false,
}: {
  id: SlotId;
  className?: string;
  eager?: boolean;
}): React.JSX.Element | null {
  const slot: Slot = SLOTS[id];
  const ratio = `${slot.width} / ${slot.height}`;
  if (!slot.src) {
    if (!SHOW_EMPTY) return null;
    return (
      <div className={`visual-slot ${className}`} style={{ aspectRatio: ratio }} data-slot={id}>
        <p>
          <b>{id}</b>
          <span>
            {slot.width} × {slot.height}
          </span>
          {slot.brief}
        </p>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static picture, already at its size (D-140)
    <img
      src={slot.src}
      alt={slot.alt}
      width={slot.width}
      height={slot.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={`visual-slot-img ${className}`}
      style={{ aspectRatio: ratio }}
    />
  );
}

/** Whether a slot will draw anything on this build (pages lay themselves out around an empty one). */
export const slotShown = (id: SlotId): boolean => Boolean(SLOTS[id].src) || SHOW_EMPTY;
