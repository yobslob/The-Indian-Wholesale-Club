'use client';

import { useCallback, useRef, useState } from 'react';

import { secondaryButton } from '../styles';

import { shrinkPhoto, uploadPhoto } from './upload';

export interface DraftPhoto {
  key: string;
  preview: string;
  /** Where it was uploaded; null while it uploads. */
  path: string | null;
  progress: number;
  error: string | null;
  alt: string;
}

/**
 * Photos for new listings (D-096): each one shrinks and uploads as soon as it is dropped, many at once, with its own
 * progress. The list keeps their order; the first is the main photo.
 */
export function usePhotoUploads(): {
  photos: DraftPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<DraftPhoto[]>>;
  add: (files: FileList | File[]) => DraftPhoto[];
} {
  const batch = useRef(crypto.randomUUID()).current;
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const patch = useCallback((key: string, p: Partial<DraftPhoto>) => setPhotos((list) => list.map((x) => (x.key === key ? { ...x, ...p } : x))), []);
  const add = useCallback(
    (files: FileList | File[]): DraftPhoto[] => {
      const added = [...files].map((file) => ({ key: crypto.randomUUID(), preview: URL.createObjectURL(file), path: null, progress: 0, error: null, alt: '', file }));
      setPhotos((list) => [...list, ...added.map(({ file: _file, ...p }) => p)]);
      for (const { key, file } of added) {
        void (async () => {
          try {
            const blob = await shrinkPhoto(file);
            const path = await uploadPhoto(blob, batch, (share) => patch(key, { progress: share }));
            patch(key, { path, progress: 1 });
          } catch (error) {
            patch(key, { error: error instanceof Error ? error.message : 'upload failed' });
          }
        })();
      }
      return added.map(({ file: _file, ...p }) => p);
    },
    [batch, patch],
  );
  return { photos, setPhotos, add };
}

/** Drop photos here, or choose many; on a phone, the camera or many from the gallery. */
export function DropZone({ onFiles, children }: { onFiles: (files: FileList) => void; children?: React.ReactNode }): React.JSX.Element {
  const [over, setOver] = useState(false);
  const pick = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
      className={`text-ink-muted rounded-[14px] border-2 border-dashed p-[18px] text-center text-[14px] font-medium leading-[1.4] ${
        over ? 'border-brand bg-brand/5' : 'border-ink-muted bg-paper/35'
      }`}
    >
      {children ?? (
        <>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto mb-1 hidden h-[26px] w-[26px] fill-none stroke-current stroke-[1.6] md:block">
            <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
          </svg>
          <span className="hidden md:inline">
            <b className="text-ink">Drop photos here</b>, as many as you like
          </span>
        </>
      )}
      <span className="mt-2.5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => camera.current?.click()} className={`${secondaryButton} md:hidden`}>
          Take photos
        </button>
        <button type="button" onClick={() => pick.current?.click()} className={secondaryButton}>
          <span className="md:hidden">Choose from gallery (many)</span>
          <span className="hidden md:inline">Choose files</span>
        </button>
      </span>
      <input
        ref={pick}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/**
 * The photo grid (D-096): drag to reorder (or ← on a phone), the first is the main photo, × removes, alt text under
 * each (what it shows, for screen readers), a bar while it uploads.
 */
export function PhotoGrid({ photos, setPhotos }: { photos: DraftPhoto[]; setPhotos: React.Dispatch<React.SetStateAction<DraftPhoto[]>> }): React.JSX.Element | null {
  const [dragging, setDragging] = useState<string | null>(null);
  if (photos.length === 0) return null;
  const move = (key: string, to: number): void =>
    setPhotos((list) => {
      const from = list.findIndex((p) => p.key === key);
      if (from < 0 || to < 0 || to >= list.length) return list;
      const next = list.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it!);
      return next;
    });
  return (
    <ul className="mt-3 grid grid-cols-3 gap-2 md:gap-2.5">
      {photos.map((p, i) => (
        <li
          key={p.key}
          draggable
          onDragStart={(e) => {
            setDragging(p.key);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragEnd={() => setDragging(null)}
          onDragOver={(e) => {
            if (dragging) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!dragging) return;
            e.preventDefault();
            move(dragging, i);
            setDragging(null);
          }}
          className="relative"
        >
          <div
            className={`bg-land aspect-[3/4] cursor-grab rounded-[10px] bg-cover bg-center ${dragging === p.key ? 'outline-brand rotate-[-2deg] outline outline-2 outline-offset-2' : ''}`}
            style={{ backgroundImage: `url(${p.preview})` }}
            role="img"
            aria-label={p.alt || `Photo ${i + 1}`}
          />
          {i === 0 ? (
            <span className="bg-ink text-paper absolute left-1.5 top-1.5 rounded-full px-[7px] py-[3px] text-[10px] font-bold uppercase leading-none tracking-[0.06em]">Main</span>
          ) : (
            <button
              type="button"
              aria-label={`Move photo ${i + 1} earlier`}
              onClick={() => move(p.key, i - 1)}
              className="absolute left-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[rgb(20_17_15/0.7)] text-[13px] font-bold text-white"
            >
              ←
            </button>
          )}
          <button
            type="button"
            aria-label={`Remove photo ${i + 1}`}
            onClick={() => setPhotos((list) => list.filter((x) => x.key !== p.key))}
            className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[rgb(20_17_15/0.7)] text-[13px] font-bold text-white"
          >
            ×
          </button>
          {!p.path && !p.error ? (
            <span className="absolute inset-x-2 bottom-[44px] h-[5px] overflow-hidden rounded-[3px] bg-white/60" aria-label="Uploading">
              <i className="bg-ink block h-full" style={{ width: `${Math.round(p.progress * 100)}%` }} />
            </span>
          ) : null}
          {p.error ? <span className="text-danger mt-1 block text-[12px] leading-tight">{p.error}</span> : null}
          <input
            value={p.alt}
            onChange={(e) => setPhotos((list) => list.map((x) => (x.key === p.key ? { ...x, alt: e.target.value } : x)))}
            placeholder="Add alt text"
            aria-label={`What photo ${i + 1} shows (alt text)`}
            maxLength={200}
            className="border-line bg-canvas text-ink mt-[5px] h-[30px] w-full rounded-[7px] border px-2 text-[12px]"
          />
        </li>
      ))}
    </ul>
  );
}
