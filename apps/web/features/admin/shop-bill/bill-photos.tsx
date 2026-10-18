'use client';

import { useEffect, useState } from 'react';

export interface BillPhoto {
  id: string;
  /** A signed address (an hour) to the private file. */
  url: string | null;
  pdf: boolean;
}

/**
 * The shop bill's photos (D-140, F4): drop files on the box, pick them, take one with the phone's camera, or paste a
 * screenshot anywhere on the form (the form handles the paste). Thumbnails with × to remove; a tap opens the full size.
 */
export function BillPhotos({
  photos,
  locked,
  onFiles,
  onRemove,
}: {
  photos: BillPhoto[];
  locked: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}): React.JSX.Element {
  const [over, setOver] = useState(false);
  const [viewing, setViewing] = useState<BillPhoto | null>(null);
  const pick = (list: FileList | null): void => onFiles([...(list ?? [])]);
  useEffect(() => {
    if (!viewing) return;
    const close = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setViewing(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [viewing]);

  return (
    <div className="space-y-2">
      <span className="text-ink-muted block text-[12px] font-semibold">Photos of the shop&apos;s bill</span>
      <div className="flex flex-wrap gap-2">
        {photos.map((p) => (
          <span key={p.id} className="border-line bg-surface relative h-20 w-16 overflow-hidden rounded-lg border">
            <button type="button" onClick={() => setViewing(p)} className="block h-full w-full" aria-label="Open the bill full size">
              {p.pdf || !p.url ? (
                <span className="text-ink-muted grid h-full place-items-center text-[11px] font-bold">PDF</span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a private signed address, never resized
                <img src={p.url} alt="Shop bill" className="h-full w-full object-cover" loading="lazy" />
              )}
            </button>
            {!locked ? (
              <button
                type="button"
                aria-label="Remove this photo"
                onClick={() => onRemove(p.id)}
                className="bg-ink/80 text-paper absolute right-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full text-[14px]"
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
        {!locked ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              onFiles([...e.dataTransfer.files]);
            }}
            className={`text-ink-muted grid min-h-20 min-w-[220px] flex-1 cursor-pointer place-items-center rounded-lg border border-dashed px-3 text-center text-[12.5px] ${over ? 'border-brand bg-brand/5' : 'border-line'}`}
          >
            <span>
              Drop the bill here, <u>choose files</u>, or paste a screenshot (Ctrl+V)
            </span>
            <input type="file" multiple accept="image/*,application/pdf" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
        ) : null}
        {!locked ? (
          <label className="border-line text-ink grid min-h-20 cursor-pointer place-items-center rounded-lg border px-3 text-[12.5px] font-semibold md:hidden">
            Take a photo
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
        ) : null}
      </div>
      {viewing ? (
        <div role="dialog" aria-modal="true" aria-label="Shop bill" className="fixed inset-0 z-50 grid place-items-center bg-[rgb(20_17_15/0.7)] p-4" onClick={() => setViewing(null)}>
          {viewing.pdf || !viewing.url ? (
            <a href={viewing.url ?? '#'} target="_blank" rel="noreferrer" className="bg-paper rounded-lg px-4 py-3 font-semibold underline">
              Open the PDF ↗
            </a>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a private signed address, never resized
            <img src={viewing.url} alt="Shop bill, full size" className="max-h-full max-w-full rounded-lg object-contain" />
          )}
          <button type="button" autoFocus onClick={() => setViewing(null)} className="bg-paper text-ink absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full text-[20px]" aria-label="Close">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
