import Image from 'next/image';

import {
  deleteProductPhotoAction,
  setMainPhotoAction,
  uploadProductPhotoAction,
} from '@/features/admin/actions/product-photos';
import { button, Field, input } from '@/features/admin/ui';
import { mediaUrl } from '@/lib/site';

interface Photo {
  id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
  is_primary: boolean;
}

/**
 * The product's photos on its admin page: the main one first, then in upload order (the store shows them the
 * same way). Every photo needs alt text. Photos are best at 3 : 4 portrait (design.md §Visual system 5).
 */
export function ProductPhotos({ productId, media }: { productId: string; media: Photo[] }): React.JSX.Element {
  const photos = media.slice().sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  return (
    <section className="border-line max-w-3xl space-y-3 rounded-md border p-3">
      <h2 className="font-medium">Photos ({photos.length})</h2>
      <p className="text-ink-muted text-sm">
        The main photo leads the product page and its card. Portrait 3 : 4 fits best; taller photos are cropped. JPEG, PNG,
        WebP or AVIF, up to 8 MB.
      </p>
      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="space-y-1.5 text-sm">
              <div className="bg-surface relative aspect-[3/4] overflow-hidden rounded-md">
                <Image src={mediaUrl(p.storage_path)} alt={p.alt_text} fill sizes="180px" className="object-cover" />
              </div>
              <p className="line-clamp-2">{p.alt_text}</p>
              {p.is_primary ? (
                <p className="font-medium">Main photo</p>
              ) : (
                <form action={setMainPhotoAction.bind(null, productId, p.id)}>
                  <button type="submit" className="min-h-11 underline">
                    Make main photo
                  </button>
                </form>
              )}
              <form action={deleteProductPhotoAction.bind(null, productId, p.id)}>
                <button type="submit" className="text-danger min-h-11 underline">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}
      <form action={uploadProductPhotoAction.bind(null, productId)} className="grid gap-3 sm:grid-cols-2">
        <Field label="Photo">
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required className={input} />
        </Field>
        <Field label="Alt text (what the photo shows)">
          <input name="altText" required minLength={3} maxLength={200} placeholder="e.g. Kasavu saree, full length, front" className={input} />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className={button}>
            Add photo
          </button>
        </div>
      </form>
    </section>
  );
}
