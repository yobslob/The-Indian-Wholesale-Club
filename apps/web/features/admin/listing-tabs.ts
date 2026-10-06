/** The Listings / Catalog views in the approved mockup: New, Drafts, Live, Paused (and every product), plus US clearance (D-072). */
export function listingTabs(draftCount?: number): { href: string; label: string; key: string }[] {
  return [
    { key: 'new', href: '/admin/listings', label: 'New' },
    { key: 'draft', href: '/admin/catalog?status=draft', label: draftCount ? `Drafts ${draftCount}` : 'Drafts' },
    { key: 'live', href: '/admin/catalog?status=live', label: 'Live' },
    { key: 'paused', href: '/admin/catalog?status=paused', label: 'Paused' },
    { key: 'us', href: '/admin/catalog?us=1', label: 'US clearance' },
    { key: 'all', href: '/admin/catalog', label: 'All' },
  ];
}
