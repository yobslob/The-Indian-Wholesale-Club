import { t, type Language } from '@repo/shared/vendor';

import { vendorSignOutAction } from './actions';
import { Icon } from './icons';
import { LanguageSwitch, VendorTabs } from './nav';

/**
 * The vendor screens' frame (D-103), phone first: the shop's name and the language switch on top, five big tabs at
 * the bottom within thumb reach. Store tokens and fonts; no admin code (lint-enforced).
 */
export function VendorShell({
  lang,
  shopName,
  children,
}: {
  lang: Language;
  shopName: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="font-ui bg-canvas text-ink mx-auto flex min-h-screen max-w-xl flex-col">
      <header className="border-line bg-paper sticky top-0 z-10 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-muted text-[12px] font-semibold uppercase tracking-[0.08em]">{t(lang, 'brand')}</p>
            <p className="font-heading truncate text-[17px] font-semibold">{shopName}</p>
          </div>
          <form action={vendorSignOutAction}>
            <button className="text-ink-muted inline-flex min-h-11 min-w-11 items-center justify-center" aria-label={t(lang, 'sign_out')}>
              <Icon name="out" className="h-5 w-5" />
            </button>
          </form>
        </div>
        <div className="mt-2">
          <LanguageSwitch lang={lang} />
        </div>
      </header>
      <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
      <VendorTabs lang={lang} />
    </div>
  );
}

/** A vendor page's title, big and plain. */
export function VendorTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <h1 className="font-heading mb-4 text-[24px] font-semibold leading-tight">{children}</h1>;
}
