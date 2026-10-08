'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mediaUrl } from '@/lib/site';

import type { Media } from '@repo/db/store';

const round = 'grid place-items-center rounded-full transition-opacity disabled:cursor-default disabled:opacity-30';

/**
 * The full-size photo viewer (D-082): over the page at every size, opened at the photo that was clicked. Swipe (the
 * track scrolls with snap), the arrows, or the arrow keys move through the product's photos; × or Escape closes it and
 * focus returns to the photo that opened it. The page underneath stops scrolling while it is open (html.info-open, globals.css).
 */
export function PhotoViewer({
  media,
  name,
  start,
  onClose,
}: {
  media: Media[];
  name: string;
  start: number;
  onClose: () => void;
}): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState(start);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.scrollLeft = start * el.clientWidth; // open at the clicked photo, no slide
    close.current?.focus({ preventScroll: true });
    const root = document.documentElement;
    root.classList.add('info-open');
    const sync = (): void => setAt(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener('scroll', sync, { passive: true });
    return () => {
      el.removeEventListener('scroll', sync);
      root.classList.remove('info-open');
    };
  }, [start]);

  const go = useCallback((dir: 1 | -1): void => {
    const el = track.current;
    if (!el) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const many = media.length > 1;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${name}`}
      data-lenis-prevent
      className="viewer-in fixed inset-0 z-[80] bg-[rgb(20_17_15/0.94)]"
    >
      <div
        ref={track}
        className="no-scrollbar absolute inset-x-0 bottom-[72px] top-16 flex snap-x snap-mandatory overflow-x-auto overscroll-contain"
      >
        {media.map((m, i) => (
          <figure key={m.id} className="relative m-0 h-full shrink-0 basis-full snap-center md:px-20">
            <div className="relative size-full">
              <Image
                src={mediaUrl(m.storage_path)}
                alt={m.alt_text || `${name}, photo ${i + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
                loading={Math.abs(i - start) <= 1 ? 'eager' : 'lazy'}
              />
            </div>
          </figure>
        ))}
      </div>
      <button
        ref={close}
        type="button"
        aria-label="Close photos"
        onClick={onClose}
        className="absolute right-4 top-3 grid size-11 place-items-center rounded-full text-white"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      {many ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => go(-1)}
            disabled={at <= 0}
            className={`${round} bg-paper text-ink font-ui absolute bottom-3.5 left-4 size-10 md:bottom-auto md:left-6 md:top-1/2 md:size-[52px] md:-translate-y-1/2`}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => go(1)}
            disabled={at >= media.length - 1}
            className={`${round} bg-paper text-ink font-ui absolute bottom-3.5 right-4 size-10 md:bottom-auto md:right-6 md:top-1/2 md:size-[52px] md:-translate-y-1/2`}
          >
            <span aria-hidden="true">→</span>
          </button>
        </>
      ) : null}
      <p className="font-ui absolute inset-x-0 bottom-6 m-0 text-center text-sm font-medium text-white" aria-live="polite">
        {at + 1} / {media.length}
      </p>
    </div>
  );
}
