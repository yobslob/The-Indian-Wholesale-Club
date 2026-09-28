import { SITE_NAME } from '@/lib/site';

import type { Metadata } from 'next';

/**
 * Hidden admin (D-006): never linked from the storefront, not in the sitemap or
 * robots.txt, and never indexed. This route group is a separate bundle, so its
 * code only downloads when someone opens /admin.
 */
export const metadata: Metadata = {
  // The plain site name, as on any 404: a customer who is refused /admin gets a page
  // whose tab title doesn't say "Admin" either (checked by e2e/hidden-admin.spec.ts).
  title: { absolute: SITE_NAME },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="bg-canvas text-ink min-h-screen text-sm">{children}</div>;
}
