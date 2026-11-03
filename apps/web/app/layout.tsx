import { siteUrl } from '@/lib/env';
import { SITE_NAME } from '@/lib/site';

import { fontVariables } from './fonts';
import './globals.css';

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  // TODO(founder): approve the site description (storefront.md voice). Draft, D-019.
  description: 'Clothing, food and gifts from every state of India, delivered in the US.',
  // E-2a: every canonical, og:url and og:image a page gives as a path is made absolute on the domain (siteUrl()).
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Fonts: the founder's set (storefront.md §Direction), self-hosted with next/font (app/fonts.ts). */
export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-canvas text-ink font-body min-h-screen antialiased">{children}</body>
    </html>
  );
}
