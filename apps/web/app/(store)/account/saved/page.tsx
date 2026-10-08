import { listSavedProducts } from '@repo/db/account';

import { unsaveProductAction } from '@/features/account/actions';
import { requireCustomer } from '@/features/account/session';
import { ProductCard, ProductGrid } from '@/features/catalog/product-card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Saved', robots: { index: false } };

export default async function SavedPage(): Promise<React.JSX.Element> {
  const { client } = await requireCustomer('/account/saved');
  const products = await listSavedProducts(client);
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Saved</h1>
      {products.length === 0 ? (
        <p className="text-ink-muted">Nothing saved yet.</p>
      ) : (
        <ProductGrid>
          {products.map((p) => (
            <div key={p.id} className="space-y-1">
              <ProductCard product={p} />
              <form action={unsaveProductAction.bind(null, p.id)}>
                <button type="submit" className="min-h-11 text-xs underline">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </ProductGrid>
      )}
    </div>
  );
}
