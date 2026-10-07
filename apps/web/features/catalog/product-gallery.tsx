'use client';

import Image from 'next/image';
import { useState } from 'react';

import { mediaUrl } from '@/lib/site';

import type { Media } from '@repo/db/store';

/**
 * Product photos (D-051): one full-length photo, never taller than the screen, with up to three stacked
 * beside it; choosing one of those puts it in the large spot. The only state is which photo is large.
 */
export function ProductGallery({ media, name }: { media: Media[]; name: string }): React.JSX.Element {
  const [mainIndex, setMainIndex] = useState(0);
  if (media.length === 0) {
    return (
      <div className="bg-surface text-ink-muted font-ui grid aspect-[3/4] w-full place-items-center rounded-lg text-sm md:h-[min(calc(100svh-110px),900px)] md:min-h-[480px] md:w-auto">
        Photo coming soon
      </div>
    );
  }
  const main = media[mainIndex] ?? media[0];
  const others = media.filter((_, i) => i !== mainIndex).slice(0, 3);

  return (
    <figure className="m-0">
      <div className="flex flex-col gap-[var(--gap)] md:h-[min(calc(100svh-110px),900px)] md:min-h-[480px] md:flex-row">
        <div className="bg-surface relative aspect-[3/4] w-full overflow-hidden rounded-lg md:h-full md:w-auto">
          <Image
            src={mediaUrl(main.storage_path)}
            alt={main.alt_text || name}
            fill
            priority
            sizes="(min-width: 768px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
        {others.length > 0 ? (
          <div className="grid grid-cols-3 gap-[var(--gap)] md:flex md:h-full md:flex-col">
            {others.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMainIndex(media.indexOf(m))}
                aria-label={`Show photo: ${m.alt_text || name}`}
                className="bg-surface focus-visible:outline-brand relative aspect-[3/4] overflow-hidden rounded-md md:h-[calc((100%-2*var(--gap))/3)] md:w-auto"
              >
                <Image src={mediaUrl(m.storage_path)} alt="" fill sizes="(min-width: 768px) 12vw, 33vw" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {main.credit ? (
        // A free-licence photo's attribution (demo round, D-078).
        <figcaption className="text-ink-muted mt-2 max-w-prose text-xs">Photo: {main.credit}</figcaption>
      ) : null}
    </figure>
  );
}
