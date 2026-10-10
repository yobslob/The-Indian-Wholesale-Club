import { notFound } from 'next/navigation';

import { vendorCategories, vendorSubmission } from '@repo/db/vendor';
import { t, type Wears } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { Icon } from '@/features/vendor/icons';
import { NewPiece } from '@/features/vendor/new-piece';
import { photoUrls } from '@/features/vendor/photos';
import { VendorTitle } from '@/features/vendor/shell';
import { pieceStatus, TONE_CLASS } from '@/features/vendor/status';

const VIEWS = ['front', 'back', 'closeup'] as const;

/**
 * One piece the shop sent (D-103): its state and photos. When IWC asked for new photos (or it was never sent), the same
 * guided steps open with what it already has, so only the photos that need it are taken again. Once in the store,
 * the shop sees its piece's store photo.
 */
export default async function PiecePage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const { client, lang } = await requireVendorPage();
  const piece = await vendorSubmission(client, id).catch(() => null);
  if (!piece) notFound();
  const status = pieceStatus('submission', piece.status);
  const [front, back, closeup, product] = await photoUrls(client, [
    ...VIEWS.map((v) => ({ bucket: 'vendor-uploads' as const, path: piece.photos[v] ?? null })),
    { bucket: 'product-media' as const, path: piece.product?.photo_path ?? null },
  ]);

  if (piece.status === 'needs_retake' || piece.status === 'adding') {
    const categories = await vendorCategories(client);
    const category = categories.find((c) => c.id === piece.category_id) ?? null;
    const { data: account } = await client.from('vendor_accounts').select('vendor_id').maybeSingle();
    if (!account) notFound();
    return (
      <>
        <VendorTitle>{t(lang, piece.status === 'needs_retake' ? 'take_new_photos' : 'add_piece')}</VendorTitle>
        {piece.retake_reason ? (
          <p role="alert" className="bg-danger/10 text-danger mb-4 flex items-start gap-2 rounded-[12px] p-3 text-[16px] font-semibold">
            <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" /> {t(lang, `reason_${piece.retake_reason}`)}
          </p>
        ) : null}
        <NewPiece
          lang={lang}
          vendorId={account.vendor_id}
          categories={categories}
          existing={
            category
              ? {
                  id: piece.id,
                  category,
                  wears: (piece.details.wears as Wears | undefined) ?? null,
                  photos: { front: front ?? undefined, back: back ?? undefined, closeup: closeup ?? undefined },
                  details: {
                    sizes: piece.variants,
                    price: piece.shop_price_paise ? String(Math.round(piece.shop_price_paise / 100)) : '',
                    fabric: piece.details.fabric ?? '',
                    care: piece.details.care ?? '',
                    colour: piece.details.colour ?? '',
                    note: piece.details.note ?? '',
                  },
                }
              : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      <VendorTitle>{piece.product?.name ?? t(lang, 'my_pieces')}</VendorTitle>
      <p className={`mb-4 inline-block rounded-full px-3 py-1 text-[15px] font-semibold ${TONE_CLASS[status.tone]}`}>{t(lang, status.key)}</p>
      {product ? (
        <figure className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- one store photo, shown at its size */}
          <img src={product} alt="" className="border-line mx-auto max-h-[60vh] rounded-[14px] border object-contain" />
          <figcaption className="text-ink-muted mt-1 text-center text-[14px]">{t(lang, 'in_store_photo')}</figcaption>
        </figure>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {[front, back, closeup].map((src, i) =>
          src ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's own photos (signed URLs)
            <img key={VIEWS[i]} src={src} alt="" className="border-line aspect-[3/4] w-full rounded-[10px] border object-cover" />
          ) : (
            <span key={VIEWS[i]} className="bg-surface aspect-[3/4] rounded-[10px]" />
          ),
        )}
      </div>
    </>
  );
}
