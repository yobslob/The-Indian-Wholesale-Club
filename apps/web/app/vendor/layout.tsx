import { SITE_NAME } from '@/lib/site';

import type { Metadata, Viewport } from 'next';

/**
 * Vendor screens (D-102, D-103): reached only from the link or QR code IWC gives a shop, never linked from the store,
 * not in the sitemap and never indexed. A separate route group, so its code downloads only here.
 */
export const metadata: Metadata = {
  title: { absolute: SITE_NAME },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FBF8F3' };

export default function VendorRootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="bg-canvas text-ink min-h-screen">{children}</div>;
}
