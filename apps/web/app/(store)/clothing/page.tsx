import { BrowseByType } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Clothing' };

export default function ClothingPage(): React.JSX.Element {
  return (
    <BrowseByType
      productType="clothing"
      title="Clothing"
      emptyText="New pieces are on their way."
    />
  );
}
