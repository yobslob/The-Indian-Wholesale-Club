'use client';

import { useState, useTransition } from 'react';

import { StorePhoto } from '@/features/catalog/store-photo';
import { albumTiles } from '@/features/regions/album-tiles';
import { mediaUrl } from '@/lib/site';

import { orderHomePhotosAction, removeHomePhotoAction, updateHomePhotoAltAction } from '../actions/home-photos';
import { button, dangerButton, input, secondaryButton } from '../styles';

export interface HomePhoto {
  id: string;
  storage_path: string;
  alt_text: string;
}

/** Moves the photo at `from` to `to`, the others closing up behind it. */
const move = (list: HomePhoto[], from: number, to: number): HomePhoto[] => {
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it!);
  return next;
};

/**
 * Home's mosaic as Home will lay it out (album-tiles.ts, D-169): the founder drags a photo onto another tile to put it
 * there, or picks a photo and moves it one place either way, first or last; Save order keeps it. Faded tiles are the
 * photos again from the first, as Home repeats them while there are fewer photos than tiles. The picked photo's line
 * can be changed, or the photo removed.
 */
export function HomePhotosGrid({ photos }: { photos: HomePhoto[] }): React.JSX.Element {
  const [order, setOrder] = useState(photos);
  const [picked, setPicked] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [line, setLine] = useState('');
  const [pending, start] = useTransition();
  const changed = order.some((p, i) => p.id !== photos[i]?.id);
  const at = order.findIndex((p) => p.id === picked);
  const current = at >= 0 ? order[at]! : null;

  const pick = (photo: HomePhoto): void => {
    setPicked(photo.id === picked ? null : photo.id);
    setLine(photo.alt_text);
  };
  const shift = (to: number): void => setOrder((list) => move(list, at, to));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <ul
          className="m-0 grid w-max list-none gap-1.5 p-0"
          style={{ gridTemplateRows: 'repeat(4, 44px)', gridAutoColumns: '44px' }}
        >
          {albumTiles(order.length).map((t, i) => {
            const photo = order[t.photo]!;
            const repeat = i >= order.length;
            return (
              <li
                key={i}
                style={{ gridColumn: `${t.column} / span ${t.columns}`, gridRow: `${t.row} / span ${t.rows}` }}
                className={`relative overflow-hidden rounded-lg ${repeat ? 'opacity-35' : ''} ${
                  picked === photo.id && !repeat ? 'ring-brand ring-[3px]' : ''
                } ${dragging !== null && !repeat ? 'outline-dashed outline-1 outline-ink-muted' : ''}`}
                draggable={!repeat}
                onDragStart={() => setDragging(t.photo)}
                onDragEnd={() => setDragging(null)}
                onDragOver={(e) => {
                  if (!repeat && dragging !== null) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging !== null && !repeat) setOrder((list) => move(list, dragging, t.photo));
                  setDragging(null);
                }}
              >
                <button
                  type="button"
                  disabled={repeat}
                  onClick={() => pick(photo)}
                  aria-label={`Photo ${t.photo + 1}: ${photo.alt_text}`}
                  className="bg-surface absolute inset-0 cursor-grab"
                >
                  <StorePhoto src={mediaUrl(photo.storage_path)} alt="" sizes={`${t.columns * 50}px`} className="object-cover" />
                  {repeat ? null : (
                    <span className="bg-ink/70 text-paper absolute left-1 top-1 rounded px-1.5 text-[11px] font-semibold">
                      {t.photo + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {current ? (
        <div className="border-line grid gap-3 rounded-[12px] border p-3 sm:grid-cols-[120px_1fr]">
          <div className="bg-surface relative aspect-square overflow-hidden rounded-md">
            <StorePhoto src={mediaUrl(current.storage_path)} alt={current.alt_text} sizes="120px" className="object-cover" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              Photo {at + 1} of {order.length}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} disabled={at === 0} onClick={() => shift(0)}>
                First
              </button>
              <button type="button" className={secondaryButton} disabled={at === 0} onClick={() => shift(at - 1)}>
                ← Earlier
              </button>
              <button type="button" className={secondaryButton} disabled={at === order.length - 1} onClick={() => shift(at + 1)}>
                Later →
              </button>
              <button type="button" className={secondaryButton} disabled={at === order.length - 1} onClick={() => shift(order.length - 1)}>
                Last
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={line}
                onChange={(e) => setLine(e.target.value)}
                maxLength={300}
                aria-label="What the photo shows"
                className={input}
              />
              <button
                type="button"
                className={secondaryButton}
                disabled={pending || !line.trim() || line === current.alt_text}
                onClick={() => start(() => updateHomePhotoAltAction(current.id, line))}
              >
                Save line
              </button>
            </div>
            <button
              type="button"
              className={dangerButton}
              disabled={pending}
              onClick={() => {
                if (!window.confirm('Remove this photo from Home? Its file is deleted.')) return;
                start(async () => {
                  await removeHomePhotoAction(current.id);
                  setOrder((list) => list.filter((p) => p.id !== current.id));
                  setPicked(null);
                });
              }}
            >
              Remove from Home
            </button>
          </div>
        </div>
      ) : null}

      {changed ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={button}
            disabled={pending}
            onClick={() => start(() => orderHomePhotosAction(order.map((p) => p.id)))}
          >
            {pending ? 'Saving…' : 'Save order'}
          </button>
          <button type="button" className={secondaryButton} disabled={pending} onClick={() => setOrder(photos)}>
            Undo changes
          </button>
          <span className="text-ink-muted text-sm">Home shows the new order once you save it.</span>
        </div>
      ) : null}
    </div>
  );
}
