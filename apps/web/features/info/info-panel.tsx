'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { INFO_LINKS } from '@/lib/site';

/**
 * The info pages as a glass panel over the page they were opened from (D-092): frosted glass (a soft blur of the page
 * behind, D-080), tabs for all seven, a small × (32 px, a 44 px tap area). Close: ×, Escape, a click outside or Back.
 * The tabs replace the address instead of adding history, so Back always closes. Rendered by the intercepting routes
 * in app/(store)/@info; a direct visit to the same address draws the plain page instead. It hides itself once the
 * address is no longer an info page (a parallel slot keeps its last content on other navigations).
 */
export function InfoPanel({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element | null {
  const router = useRouter();
  const path = usePathname();
  const close = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const open = INFO_LINKS.some((l) => l.href === path);

  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    body.current?.scrollTo(0, 0);
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') router.back();
    };
    document.addEventListener('keydown', onKey);
    document.documentElement.classList.add('info-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('info-open');
    };
  }, [open, path, router]);

  if (!open) return null;
  return (
    <>
      <div className="info-scrim" aria-hidden="true" onClick={() => router.back()} />
      <section className="info-glass" role="dialog" aria-modal="true" aria-label={title}>
        <header className="info-head font-ui">
          <nav className="info-tabs no-scrollbar" aria-label="Information">
            {INFO_LINKS.map((l) => (
              <Link key={l.href} href={l.href} replace scroll={false} aria-current={l.href === path ? 'page' : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <button ref={close} type="button" className="info-close" aria-label="Close" onClick={() => router.back()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div ref={body} className="info-body" data-lenis-prevent>
          <h2 className="font-heading text-[clamp(28px,3vw,40px)] font-medium leading-[1.1] tracking-[-0.02em] text-[#1D1A17]">
            {title}
          </h2>
          <div className="text-ink mt-3.5 max-w-[64ch] space-y-3 text-base leading-relaxed">{children}</div>
        </div>
      </section>
    </>
  );
}
