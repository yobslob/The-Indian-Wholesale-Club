import type { PhotoCredit } from '@repo/shared/domain';

/**
 * D-214: the credit an openly licensed recipe photo asks for (CC BY, BY-SA): its title and author linked to where it
 * is published, its licence linked to the licence. The page shows the photo cropped to its frame, so it says so.
 */
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }): React.JSX.Element {
  const link = 'underline-offset-2 hover:underline';
  return (
    <figcaption className="font-ui text-ink-muted mt-1.5 text-[11px] leading-snug">
      Photo:{' '}
      <a href={credit.source_url} rel="nofollow noopener" target="_blank" className={link}>
        {credit.title ? `“${credit.title}” by ${credit.author}` : credit.author}
      </a>
      ,{' '}
      {credit.licence_url ? (
        <a
          href={credit.licence_url}
          rel="license nofollow noopener"
          target="_blank"
          className={link}
        >
          {credit.licence}
        </a>
      ) : (
        credit.licence
      )}
      , cropped
    </figcaption>
  );
}
