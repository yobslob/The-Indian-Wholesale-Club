import { getHomeCached } from '@/features/catalog/data';
import { RegionGrid } from '@/features/regions/region-card';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pick your home' };

/** All 36 regions A–Z, states and UTs together (D-002). Same cached call as the home page. */
export default async function StatesPage(): Promise<React.JSX.Element> {
  const { regions } = await getHomeCached();
  const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return (
    <div className="space-y-6">
      <h1 className="text-ink text-2xl font-semibold">Pick your home</h1>
      <RegionGrid regions={sorted} />
    </div>
  );
}
