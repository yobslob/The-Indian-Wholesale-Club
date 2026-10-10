import Link from 'next/link';

import { vendorPieces } from '@repo/db/vendor';
import { pieceStatus, t, TONE_CLASS } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { photoUrls } from '@/features/vendor/photos';
import { VendorTitle } from '@/features/vendor/shell';

/** My pieces (D-103): what the shop sent and what is in the store, newest first, each with its photo and state. */
export default async function PiecesPage(): Promise<React.JSX.Element> {
  const { client, lang } = await requireVendorPage();
  const { items } = await vendorPieces(client, 0, 50);
  const photos = await photoUrls(client, items.map((p) => ({ bucket: p.photo_bucket, path: p.photo_path })));

  return (
    <>
      <VendorTitle>{t(lang, 'my_pieces')}</VendorTitle>
      {items.length === 0 ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-[17px]">{t(lang, 'no_pieces')}</p>
          <Link href="/vendor/new" className="bg-brand text-on-brand flex min-h-14 items-center justify-center rounded-[14px] text-[17px] font-semibold">{t(lang, 'add_piece')}</Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((p, i) => {
            const status = pieceStatus(p.kind, p.status);
            const inner = (
              <>
                <span className="bg-surface relative h-20 w-16 shrink-0 overflow-hidden rounded-[10px]">
                  {photos[i] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private signed URLs and small thumbnails
                    <img src={photos[i] ?? ''} alt="" className="h-full w-full object-cover" loading={i > 6 ? 'lazy' : 'eager'} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">{p.name ?? p.category ?? '—'}</span>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${TONE_CLASS[status.tone]}`}>{t(lang, status.key)}</span>
                  {p.pieces_left !== null ? <span className="text-ink-muted ml-2 text-[13px]">{t(lang, 'pieces_left', { n: p.pieces_left })}</span> : null}
                </span>
              </>
            );
            return (
              <li key={`${p.kind}-${p.id}`}>
                {p.kind === 'submission' ? (
                  <Link href={`/vendor/pieces/${p.id}`} className="border-line bg-paper flex items-center gap-3 rounded-[14px] border p-2.5">{inner}</Link>
                ) : (
                  <div className="border-line bg-paper flex items-center gap-3 rounded-[14px] border p-2.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
