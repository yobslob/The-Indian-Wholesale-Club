import { listSavedProducts } from '@repo/db/account';

import { unsaveProductAction } from '@/features/account/actions';
import { customerOrNull } from '@/features/account/session';
import { ProductCard } from '@/features/catalog/product-card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Saved', robots: { index: false } };

/** Saved (D-089): the standard cards (D-080), each with a filled heart on the photo that removes the piece. */
export default async function SavedPage(): Promise<React.JSX.Element | null> {
  const me = await customerOrNull();
  if (!me) return null;
  const products = await listSavedProducts(me.client);
  return (
    <section aria-labelledby="saved-h">
      <h2 id="saved-h" className="font-heading m-0 mb-4 text-[22px] font-medium leading-tight text-[#1D1A17]">
        Saved
      </h2>
      {products.length === 0 ? (
        <p className="text-ink-muted font-body m-0 text-[15px]">Nothing saved yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-7 min-[821px]:grid-cols-3">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              corner={
                <form action={unsaveProductAction.bind(null, p.id)}>
                  <button
                    type="submit"
                    aria-label={`Remove ${p.name} from saved`}
                    className="border-line bg-paper text-brand grid size-10 place-items-center rounded-full border"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="currentColor">
                      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
                    </svg>
                  </button>
                </form>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
