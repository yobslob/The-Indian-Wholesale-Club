import { SITE_NAME } from '@/lib/site';

import { fontVariables } from './fonts';
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

/** Fonts: the founder's set (design.md §Direction), self-hosted with next/font (app/fonts.ts). */
export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-canvas text-ink font-body min-h-screen antialiased">{children}</body>
    </html>
  );
}
