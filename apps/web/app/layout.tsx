import { SITE_NAME } from '@/lib/site';

import './globals.css';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  // TODO(founder): approve the site description (design.md voice). Draft, D-019.
  description: 'Clothing and spices from every state of India, delivered in the US.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  ),
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** No web fonts until the design is approved (design.md); system fonts are the fastest (D-011). */
export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
