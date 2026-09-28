import type { Metadata } from 'next';

/**
 * Hidden admin (D-006): never linked from the storefront, not in the sitemap or
 * robots.txt, and never indexed. This route group is a separate bundle, so its
 * code only downloads when someone opens /admin.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <div className="bg-canvas text-ink min-h-screen text-sm">{children}</div>;
}
