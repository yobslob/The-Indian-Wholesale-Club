import Image from 'next/image';

import { reviewPhotoUrl } from '@/lib/site';

import { WriteReview } from './write-review';

import type { ReviewsSummary } from '@repo/db/store';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function Stars({ rating, label }: { rating: number; label: string }): React.JSX.Element {
  return (
    <p className="text-brand m-0 text-base tracking-[2px]" role="img" aria-label={label}>
      {'★'.repeat(Math.round(rating))}
      <span className="text-line">{'★'.repeat(5 - Math.round(rating))}</span>
    </p>
  );
}

/**
 * Reviews on the product page (D-051, D-056): the summary of every approved review and the three newest, on the
 * four-column grid (a sideways row on phones, D-082). Only approved reviews reach this data (store_reviews); photos come from verified buyers.
 */
export function ReviewsSection({
  reviews,
  productId,
}: {
  reviews: ReviewsSummary;
  productId: string;
}): React.JSX.Element {
  const newest = reviews.items.slice(0, 3);
  return (
    <section aria-labelledby="reviews" className="py-[clamp(28px,3.4vw,56px)]">
      <div className="mb-[clamp(18px,2vw,28px)] flex flex-wrap items-end justify-between gap-4">
        <h2
          id="reviews"
          className="font-heading text-[clamp(26px,2.2vw,38px)] font-medium leading-tight tracking-[-0.025em]"
        >
          Reviews
        </h2>
        <WriteReview productId={productId} />
      </div>

      {reviews.count === 0 ? (
        <p className="bg-surface font-body rounded-lg p-[clamp(18px,2vw,32px)] text-[clamp(20px,1.8vw,28px)]">
          No reviews yet.
        </p>
      ) : (
        <div className="grid gap-[var(--gap)] md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-surface rounded-lg p-[clamp(18px,2vw,32px)]">
            <p className="font-heading m-0 text-6xl font-medium leading-none tracking-[-0.04em]">
              {reviews.average?.toFixed(1)}
            </p>
            <Stars
              rating={reviews.average ?? 0}
              label={`${reviews.average?.toFixed(1)} out of 5`}
            />
            <p className="text-ink-muted m-0 text-sm">
              Based on {reviews.count} {reviews.count === 1 ? 'review' : 'reviews'}
            </p>
            <div className="font-ui mt-4 grid gap-1.5 text-xs font-medium" aria-hidden="true">
              {(['5', '4', '3', '2', '1'] as const).map((star) => {
                const n = reviews.histogram[star] ?? 0;
                return (
                  <div key={star} className="grid grid-cols-[14px_1fr_28px] items-center gap-2">
                    {star}
                    <i className="bg-line rounded-pill block h-1.5 overflow-hidden">
                      <b
                        className="bg-ink block h-full"
                        style={{ width: `${(n / reviews.count) * 100}%` }}
                      />
                    </i>
                    {n}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Phones: the cards are a sideways row under the summary (D-082); wider, grid cells beside it. */}
          <div className="no-scrollbar -mx-[var(--gut)] flex snap-x snap-mandatory scroll-px-[var(--gut)] gap-3 overflow-x-auto px-[var(--gut)] md:contents">
            {newest.map((r) => (
              <article
                key={r.id}
                className="border-line bg-paper flex w-[82%] shrink-0 snap-start flex-col gap-2.5 rounded-lg border p-[clamp(18px,2vw,32px)] md:w-auto"
              >
                <Stars rating={r.rating} label={`${r.rating} out of 5`} />
                <p className="m-0 whitespace-pre-line text-[14.5px]">{r.body}</p>
                {r.photos.length > 0 ? (
                  <div className="flex gap-2">
                    {r.photos.map((path) => (
                      <div
                        key={path}
                        className="bg-land relative size-16 overflow-hidden rounded-md"
                      >
                        <Image
                          src={reviewPhotoUrl(path)}
                          alt={`Photo from ${r.display_name}`}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                <footer className="font-ui text-ink-muted mt-auto flex justify-between gap-2 text-xs font-medium">
                  <span>
                    {r.is_demo ? (
                      <span className="text-caution font-medium">Demo review · </span>
                    ) : null}
                    {r.is_verified_buyer ? (
                      <span className="text-positive">✓ Verified buyer · </span>
                    ) : null}
                    {r.display_name}
                  </span>
                  <time dateTime={r.created_at}>{dateFormat.format(new Date(r.created_at))}</time>
                </footer>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
