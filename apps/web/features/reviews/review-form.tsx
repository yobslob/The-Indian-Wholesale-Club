'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { LinePhoto } from '@/features/cart/bag-lines';

import { submitReviewAction, type ReviewPiece } from './actions';
import { MAX_REVIEW_PHOTOS } from './limits';

const label = 'font-ui text-ink-muted mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em]';
const box = 'border-line bg-paper focus:border-ink block w-full rounded-md border px-3 py-2.5 text-[15px] outline-none';

/** The piece the review is about (D-090): photo, name in Cinzel, category · state. */
export function PieceLine({ piece }: { piece: ReviewPiece }): React.JSX.Element {
  return (
    <div className="bg-surface mb-[22px] grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3.5 rounded-md p-3">
      <LinePhoto path={piece.primary_image_path} className="w-14 rounded-[10px]" />
      <span className="min-w-0">
        <b className="font-display block text-lg font-normal leading-tight text-[#1D1A17]">{piece.name}</b>
        <small className="font-ui text-ink-muted text-[13px]">
          {piece.category_name} · {piece.region_name}
        </small>
      </span>
    </div>
  );
}

function Star(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[34px] transition-[fill]">
      <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z" />
    </svg>
  );
}

/**
 * Writing a review (D-090), in the panel over the product and on /account/reviews/[productId]: the rating as one row of
 * five large stars (tap, or the arrow keys: they are radio buttons, "n of 5" beside them), the text and the name to
 * show, and for verified buyers photo tiles with previews, × to remove and "+ Add photo" (hidden at 4). Fields,
 * limits and texts as built (D-051, D-052, D-056); the server checks them all again.
 */
export function ReviewForm({
  piece,
  verified,
  reviewed,
  displayName,
}: {
  piece: ReviewPiece;
  verified: boolean;
  reviewed: boolean;
  displayName: string;
}): React.JSX.Element {
  const [rating, setRating] = useState(0);
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ note?: string } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const back = `/states/${piece.region_slug}/${piece.slug}`;

  // Previews are object URLs: each one goes when its tile does, the rest when the form does.
  const shown = useRef(photos);
  shown.current = photos;
  useEffect(() => () => shown.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  if (sent || reviewed) {
    return (
      <>
        <PieceLine piece={piece} />
        <p className="bg-surface font-body rounded-lg p-[22px] text-base" role="status">
          {sent ? 'Thank you. We read every review before it appears on the page.' : `You have already reviewed ${piece.name}.`}
          {sent?.note ? ` ${sent.note}` : ''}{' '}
          <Link href={back} className="underline underline-offset-[3px]">
            Back to {piece.name}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <PieceLine piece={piece} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          form.delete('photos');
          for (const p of photos) form.append('photos', p.file);
          setBusy(true);
          setError(null);
          void submitReviewAction(piece.id, form).then((result) => {
            setBusy(false);
            if ('error' in result) setError(result.error);
            else setSent({ note: result.note });
          });
        }}
      >
        <fieldset className="mb-[22px] flex items-center gap-1 border-0 p-0">
          <legend className={label}>Your rating</legend>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={`grid size-11 cursor-pointer place-items-center ${n <= rating ? 'fill-brand' : 'fill-line'}`}>
              <input
                type="radio"
                name="rating"
                value={n}
                required
                aria-label={`${n} of 5`}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="peer absolute opacity-0"
              />
              <span className="peer-focus-visible:outline-brand rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                <Star />
              </span>
            </label>
          ))}
          <output className="font-ui ml-2.5 text-[15px] font-semibold" aria-live="polite">
            {rating ? `${rating} of 5` : ''}
          </output>
        </fieldset>
        <label className="mb-[18px] block">
          <span className={label}>Your review</span>
          <textarea name="body" required maxLength={2000} className={`${box} font-body min-h-[140px]`} />
        </label>
        <label className="mb-[18px] block">
          <span className={label}>Name to show</span>
          <input name="displayName" required maxLength={60} defaultValue={displayName} className={`${box} min-h-12`} />
        </label>
        {verified ? (
          <>
            <span className={label}>Photos (up to {MAX_REVIEW_PHOTOS}, optional)</span>
            <div className="mb-2 grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <span key={p.url} className="bg-land relative aspect-square overflow-hidden rounded-xl">
                  {/* A local preview of the customer's own file, not a stored image: next/image has nothing to resize. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove photo ${i + 1}`}
                    onClick={() => {
                      URL.revokeObjectURL(p.url);
                      setPhotos((all) => all.filter((x) => x !== p));
                    }}
                    className="font-ui absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-[rgb(20_17_15/0.7)] text-[15px] font-semibold text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
              {photos.length < MAX_REVIEW_PHOTOS ? (
                <button
                  type="button"
                  onClick={() => picker.current?.click()}
                  className="border-ink-muted font-ui grid aspect-square place-items-center rounded-xl border-[1.5px] border-dashed text-center text-[13px] font-semibold leading-tight"
                >
                  <span>
                    <b className="block text-[22px] font-normal">+</b>Add photo
                  </span>
                </button>
              ) : null}
            </div>
            <input
              ref={picker}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                setPhotos((all) => [...all, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, MAX_REVIEW_PHOTOS));
                e.target.value = '';
              }}
            />
            <p className="text-ink-muted font-body mb-[22px] text-[13px]">You bought this piece, so you can add photos of it.</p>
          </>
        ) : (
          <p className="text-ink-muted font-body mb-[22px] text-[13px]">Photos can be added by customers who received this piece.</p>
        )}
        {error ? (
          <p className="text-danger mb-3 text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="bg-brand text-on-brand font-ui grid h-14 w-full place-items-center rounded-pill text-base font-semibold disabled:opacity-50">
          {busy ? 'Sending…' : 'Send review'}
        </button>
        <p className="text-ink-muted font-body mt-3 text-sm">We read every review before it appears on the page.</p>
      </form>
    </>
  );
}
