import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getMyProfile, getReviewableProduct, getReviewEligibility } from '@repo/db/account';

import { requireCustomer } from '@/features/account/session';
import { submitReviewAction } from '@/features/reviews/actions';
import { MAX_REVIEW_PHOTOS } from '@/features/reviews/limits';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Write a review', robots: { index: false } };

type Params = Promise<{ productId: string }>;
type Search = Promise<{ sent?: string }>;

const field = 'border-line bg-paper focus:border-ink w-full rounded-md border px-3 py-2.5 outline-none';
const label = 'font-ui text-ink-muted mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em]';

/** Write a review (D-051, D-056). Signed-in customers only; photos only for verified buyers. */
export default async function WriteReviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<React.JSX.Element> {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const { client, user } = await requireCustomer(`/account/reviews/${productId}`);
  const [product, eligibility, profile] = await Promise.all([
    getReviewableProduct(client, productId),
    getReviewEligibility(client, productId),
    getMyProfile(client, user.id),
  ]);
  if (!product) notFound();
  const back = `/states/${product.region_slug}/${product.slug}`;
  const sent = (await searchParams).sent === '1';

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="font-ui text-ink-muted text-[13px] font-medium">
        <Link href={back} className="underline">
          {product.name}
        </Link>{' '}
        · {product.region_name}
      </p>
      <h1 className="font-hero text-[clamp(32px,3vw,48px)] font-medium leading-tight tracking-[-0.03em]">Write a review</h1>

      {sent ? (
        <p className="bg-surface rounded-lg p-6">
          Thank you. We read every review before it appears on the page.{' '}
          <Link href={back} className="underline">
            Back to {product.name}
          </Link>
        </p>
      ) : eligibility.has_reviewed ? (
        <p className="bg-surface rounded-lg p-6">
          You have already reviewed {product.name}.{' '}
          <Link href={back} className="underline">
            Back to the product
          </Link>
        </p>
      ) : (
        <form action={submitReviewAction.bind(null, productId)} className="bg-surface space-y-5 rounded-lg p-[clamp(18px,2vw,32px)]">
          <fieldset>
            <legend className={label}>Your rating</legend>
            <div className="flex flex-wrap gap-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <label key={n} className="border-line bg-paper has-[:checked]:border-ink font-ui inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border px-4 text-sm has-[:checked]:shadow-[inset_0_0_0_1px_theme(colors.ink)]">
                  <input type="radio" name="rating" value={n} required className="accent-brand" />
                  <span aria-hidden="true" className="text-brand tracking-[1px]">
                    {'★'.repeat(n)}
                  </span>
                  <span className="sr-only">{n} out of 5</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="body" className={label}>
              Your review
            </label>
            <textarea id="body" name="body" required maxLength={2000} rows={6} className={field} />
          </div>
          <div>
            <label htmlFor="displayName" className={label}>
              Name to show
            </label>
            <input
              id="displayName"
              name="displayName"
              required
              maxLength={60}
              defaultValue={profile?.full_name?.split(' ')[0] ?? ''}
              className={field}
            />
          </div>
          {eligibility.is_verified_buyer ? (
            <div>
              <label htmlFor="photos" className={label}>
                Photos (up to {MAX_REVIEW_PHOTOS}, optional)
              </label>
              <input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" className="text-sm" />
              <p className="text-ink-muted mt-1.5 text-sm">You bought this piece, so you can add photos of it.</p>
            </div>
          ) : (
            <p className="text-ink-muted text-sm">Photos can be added by customers who received this piece.</p>
          )}
          <button type="submit" className="bg-brand text-on-brand font-ui min-h-14 w-full rounded-pill px-5 text-[15px] font-medium">
            Send review
          </button>
          <p className="text-ink-muted m-0 text-sm">We read every review before it appears on the page.</p>
        </form>
      )}
    </div>
  );
}
