'use client';

import Image from 'next/image';
import { useState } from 'react';

import type { ProductImage } from '@repo/shared/types';

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductGallery({ images, productName }: ProductGalleryProps): React.JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentImage = images[selectedIndex] || images[0];

  return (
    <div className="flex flex-col-reverse gap-4 md:flex-row md:gap-6">
      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2 md:flex-col md:overflow-y-auto md:pb-0">
          {images.map((img, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                  isSelected
                    ? 'border-primary ring-primary ring-1'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
                aria-label={`View image ${idx + 1} of ${images.length}`}
              >
                <Image
                  src={img.url}
                  alt={img.alt_text ?? `${productName} thumbnail ${idx + 1}`}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Main image viewer */}
      <div className="relative aspect-[3/4] w-full flex-1 overflow-hidden rounded-lg bg-neutral-100">
        {currentImage ? (
          <Image
            src={currentImage.url}
            alt={currentImage.alt_text ?? productName}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover transition-opacity duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-400">
            No image available
          </div>
        )}
      </div>
    </div>
  );
}
