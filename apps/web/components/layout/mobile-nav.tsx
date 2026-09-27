'use client';

import { ChevronRight, Heart, User, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { SITE_NAME } from '@repo/shared/constants';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  navigation: { name: string; href: string }[];
}

export function MobileNav({
  isOpen,
  onClose,
  navigation,
}: MobileNavProps): React.JSX.Element | null {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-4">
          <Link
            href="/"
            className="font-display text-primary text-lg font-bold tracking-tight"
            onClick={onClose}
          >
            {SITE_NAME}
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-4 py-6" aria-label="Mobile navigation">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-3 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
                  onClick={onClose}
                >
                  {item.name}
                  <ChevronRight className="h-4 w-4 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="my-6 border-t border-neutral-200" />

          {/* Account links */}
          <ul className="space-y-1">
            <li>
              <Link
                href="/account"
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                onClick={onClose}
              >
                <User className="h-4 w-4" />
                My Account
              </Link>
            </li>
            <li>
              <Link
                href="/account/wishlist"
                className="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
                onClick={onClose}
              >
                <Heart className="h-4 w-4" />
                Wishlist
              </Link>
            </li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-4 py-4">
          <Link
            href="/login"
            className="bg-primary text-primary-foreground hover:bg-primary-hover flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors"
            onClick={onClose}
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="mt-2 flex w-full items-center justify-center rounded-md border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
            onClick={onClose}
          >
            Create Account
          </Link>
        </div>
      </div>
    </>
  );
}
