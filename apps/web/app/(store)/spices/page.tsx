import { BrowseByType } from '@/features/catalog/browse-by-type';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Spices' };

/** Spices stay unpublished until the compliance question is answered (D-032, Q-10). */
export default function SpicesPage(): React.JSX.Element {
  return <BrowseByType productType="spice" title="Spices" emptyText="Spices are coming soon." />;
}
