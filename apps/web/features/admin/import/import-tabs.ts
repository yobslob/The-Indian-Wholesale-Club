/** Import from shops' three views (D-140): the importer, every imported listing (paged), auto-sourcing. */
export function importTabs(imported?: number): { key: string; href: string; label: string; count?: number }[] {
  return [
    { key: 'import', href: '/admin/import', label: 'Import' },
    { key: 'listings', href: '/admin/import/listings', label: 'Imported listings', count: imported },
    { key: 'auto', href: '/admin/import/auto', label: 'Auto-sourcing' },
  ];
}
