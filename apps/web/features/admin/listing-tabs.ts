/**
 * The Listings / Catalog views (D-096): New, Add many, Drafts, Live, Paused, Re-check, then US clearance (D-072) and
 * every product. Counts when the page has them.
 */
export function listingTabs(counts?: { draft: number; live: number; paused: number; recheck?: number | null }): {
  href: string;
  label: string;
  key: string;
  count?: number;
}[] {
  return [
    { key: 'new', href: '/admin/listings', label: 'New' },
    { key: 'many', href: '/admin/listings?view=many', label: 'Add many' },
    { key: 'draft', href: '/admin/catalog?status=draft', label: 'Drafts', count: counts?.draft },
    { key: 'live', href: '/admin/catalog?status=live', label: 'Live', count: counts?.live },
    { key: 'paused', href: '/admin/catalog?status=paused', label: 'Paused', count: counts?.paused },
    { key: 'recheck', href: '/admin/listings?view=recheck', label: 'Re-check', count: counts?.recheck ?? undefined },
    { key: 'us', href: '/admin/catalog?us=1', label: 'US clearance' },
    { key: 'all', href: '/admin/catalog', label: 'All' },
  ];
}
