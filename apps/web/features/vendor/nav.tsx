'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { LANGUAGES, switchLanguages, t, type Language } from '@repo/shared/vendor';

import { setVendorLanguageAction } from './actions';
import { Icon, type IconName } from './icons';

/** The language switch: English, Hindi and the shop's region's language, one tap each; back to the same screen. */
export function LanguageSwitch({ lang, regionLanguages = [] }: { lang: Language; regionLanguages?: string[] }): React.JSX.Element {
  const path = usePathname();
  return (
    <form action={setVendorLanguageAction} className="flex flex-wrap gap-1.5" aria-label={t(lang, 'language')}>
      <input type="hidden" name="back" value={path} />
      {switchLanguages(lang, regionLanguages).map((code) => (
        <button
          key={code}
          name="lang"
          value={code}
          aria-pressed={code === lang}
          className={`font-ui min-h-9 rounded-full border px-3 text-[13px] ${code === lang ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink'}`}
        >
          {LANGUAGES[code].name}
        </button>
      ))}
    </form>
  );
}

const TABS: { href: string; icon: IconName; key: 'add_piece' | 'my_pieces' | 'keep_ready' | 'money' | null }[] = [
  { href: '/vendor', icon: 'home', key: null },
  { href: '/vendor/new', icon: 'camera', key: 'add_piece' },
  { href: '/vendor/pieces', icon: 'pieces', key: 'my_pieces' },
  { href: '/vendor/ready', icon: 'box', key: 'keep_ready' },
  { href: '/vendor/money', icon: 'rupee', key: 'money' },
];

/** Five big tabs at the bottom, within thumb reach (D-103). */
export function VendorTabs({ lang }: { lang: Language }): React.JSX.Element {
  const path = usePathname();
  return (
    <nav className="border-line bg-paper fixed inset-x-0 bottom-0 z-10 border-t pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((tab) => {
          const current = tab.href === '/vendor' ? path === '/vendor' : path.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] leading-tight ${current ? 'text-brand font-semibold' : 'text-ink-muted'}`}
              >
                <Icon name={tab.icon} className="h-6 w-6" />
                <span className="line-clamp-2">{tab.key ? t(lang, tab.key) : 'IWC'}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
