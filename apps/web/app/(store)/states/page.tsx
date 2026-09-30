import { getHomeCached } from '@/features/catalog/data';
import { PickHome } from '@/features/regions/pick-home';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pick your home' };

/**
 * All 36 regions, states and UTs together (D-002): the same "Pick your home" section as Home (map, open regions as
 * stamps, every other region A–Z). Same cached call as the home page.
 */
export default async function StatesPage(): Promise<React.JSX.Element> {
  const { regions, delivery } = await getHomeCached();
  const sorted = [...regions].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-hero text-ink text-[clamp(32px,3vw,52px)] font-medium leading-tight tracking-[-0.03em]">Pick your home</h1>
        <p className="text-ink-muted mt-1.5 text-sm">All 28 states and 8 union territories. Find yours on the map or by name.</p>
      </div>
      <PickHome regions={sorted} delivery={delivery} />
    </div>
  );
}
