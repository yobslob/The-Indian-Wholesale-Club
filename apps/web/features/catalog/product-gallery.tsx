'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import { mediaUrl } from '@/lib/site';

import { PhotoViewer } from './photo-viewer';

import type { Media } from '@repo/db/store';

/** Wide screens: the full-length photo as tall as the screen allows, three stacked beside it (D-051). */
const tall = 'min-[1100px]:h-[min(calc(100svh-110px),900px)] min-[1100px]:min-h-[480px]';

/**
 * Product photos (D-051, D-082): one full-length photo with up to three small ones; from 1100 px the small ones stack
 * beside it, below that they sit in a row under it (tablets get two columns, phones one). Any photo opens the full-size
 * viewer at that photo, which moves through every photo of the product.
 */
export function ProductGallery({ media, name }: { media: Media[]; name: string }): React.JSX.Element {
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);

  if (media.length === 0) {
    return (
      <div className={`bg-surface text-ink-muted font-ui grid aspect-[3/4] w-full place-items-center rounded-lg text-sm ${tall} min-[1100px]:w-auto`}>
        Photo coming soon
      </div>
    );
  }
  const [main, ...rest] = media;
  const small = rest.slice(0, 3);
  const show = (i: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = e.currentTarget;
    setOpen(i);
  };

  return (
    <figure className="m-0">
      <div className={`flex flex-col gap-[var(--gap)] ${tall} min-[1100px]:flex-row`}>
        <button
          type="button"
          onClick={show(0)}
          aria-label={`Open photo 1 of ${media.length}`}
          className="bg-surface focus-visible:outline-brand relative aspect-[3/4] w-full cursor-zoom-in overflow-hidden rounded-lg min-[1100px]:h-full min-[1100px]:w-auto"
        >
          <Image
            src={mediaUrl(main.storage_path)}
            alt={main.alt_text || name}
            fill
            priority
            sizes="(min-width: 1100px) 40vw, (min-width: 768px) 52vw, 100vw"
            className="object-cover"
          />
        </button>
        {small.length > 0 ? (
          <div className="grid grid-cols-3 gap-[var(--gap)] min-[1100px]:flex min-[1100px]:h-full min-[1100px]:flex-col">
            {small.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={show(i + 1)}
                aria-label={`Open photo ${i + 2} of ${media.length}`}
                className="bg-surface focus-visible:outline-brand relative aspect-[3/4] cursor-zoom-in overflow-hidden rounded-md min-[1100px]:h-[calc((100%-2*var(--gap))/3)] min-[1100px]:w-auto"
              >
                <Image src={mediaUrl(m.storage_path)} alt="" fill sizes="(min-width: 1100px) 12vw, (min-width: 768px) 17vw, 33vw" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {main.credit ? (
        // A free-licence photo's attribution (demo round, D-078).
        <figcaption className="text-ink-muted mt-2 max-w-prose text-xs">Photo: {main.credit}</figcaption>
      ) : null}
      {open !== null ? (
        <PhotoViewer
          media={media}
          name={name}
          start={open}
          onClose={() => {
            setOpen(null);
            opener.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
    </figure>
  );
}
