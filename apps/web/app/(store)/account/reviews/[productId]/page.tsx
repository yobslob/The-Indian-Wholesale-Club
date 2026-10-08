import { notFound } from 'next/navigation';

import { SignInCard } from '@/features/auth/sign-in-card';
import { reviewFormStateAction } from '@/features/reviews/actions';
import { ReviewForm } from '@/features/reviews/review-form';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Write a review', robots: { index: false } };

type Params = Promise<{ productId: string }>;

/**
 * Write a review (D-051, D-056, D-090) at its own address, for links from outside the product page: the same form as
 * the panel. Signed out, the sign-in card first; then the same address shows the form.
 */
export default async function WriteReviewPage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const state = await reviewFormStateAction(productId);
  if (!state.signedIn) return <SignInCard />;
  if (!state.piece) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="font-heading mb-5 text-[clamp(32px,3vw,48px)] font-medium leading-tight tracking-[-0.03em] text-[#1D1A17]">
        Write a review
      </h1>
      <ReviewForm piece={state.piece} verified={state.verified} reviewed={state.reviewed} displayName={state.displayName} />
    </div>
  );
}
