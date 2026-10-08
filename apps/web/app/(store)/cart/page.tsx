import { CartView } from '@/features/cart/cart-view';
import { getHomeCached } from '@/features/catalog/data';
import { ProductRow } from '@/features/catalog/product-row';
import { postmarkFor, StampGrid } from '@/features/regions/region-stamp';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Your bag', robots: { index: false } };

/**
 * Static shell; the bag itself lives on the device. An empty bag shows the open states and Just listed under its
 * sentence (D-086), drawn here from the same cached home read as Home.
 */
export default async function CartPage(): Promise<React.JSX.Element> {
  const home = await getHomeCached();
  const open = home.regions.filter((r) => r.is_live);
  const empty = (
    <>
      {open.length > 0 ? (
        <section className="mt-[clamp(28px,3vw,40px)] space-y-3">
          <p className="font-ui text-ink-muted text-[11px] font-semibold uppercase tracking-[0.16em]">Open now</p>
          <div className="max-w-[660px]">
            <StampGrid regions={open} postmark={postmarkFor(home.delivery)} idPrefix="bg" />
          </div>
        </section>
      ) : null}
      <ProductRow id="just-listed" title="Just listed" products={home.just_listed} href="/clothing" />
    </>
  );
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em] text-[#1D1A17]">Your bag</h1>
      <CartView empty={empty} />
    </div>
  );
}
