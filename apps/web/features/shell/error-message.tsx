import Link from 'next/link';

/**
 * The not-found and error message (D-093): a heading, one line in the IWC voice and real buttons; nothing else under it.
 * The two lines were drafted in the design pass and approved with its mockup.
 */
export function ErrorMessage({
  kind,
  onRetry,
}: {
  kind: 'not-found' | 'error';
  onRetry?: () => void;
}): React.JSX.Element {
  const button = 'font-ui inline-grid min-h-[52px] place-items-center rounded-pill px-7 text-base font-semibold';
  return (
    <div className="max-w-[620px] py-[clamp(48px,8vw,120px)]">
      <h1 className="font-heading text-[clamp(34px,3.6vw,56px)] font-medium leading-[1.05] tracking-[-0.02em] text-[#1D1A17]">
        {kind === 'not-found' ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="mb-6 mt-2.5 text-lg leading-normal text-black">
        {kind === 'not-found'
          ? 'We looked everywhere, even under the bed. This page isn’t here.'
          : 'That’s on us, not you. Try again, and if it keeps happening, give it a few minutes.'}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {onRetry ? (
          <button type="button" onClick={onRetry} className={`${button} bg-brand text-on-brand`}>
            Try again
          </button>
        ) : null}
        <Link
          href="/"
          className={`${button} ${onRetry ? 'border-line bg-paper text-ink border' : 'bg-brand text-on-brand'}`}
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
