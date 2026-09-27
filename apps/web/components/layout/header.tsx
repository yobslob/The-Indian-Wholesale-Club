'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { SITE_NAME } from '@repo/shared/constants';

import { CartDrawer } from '@/components/cart';
import { useCartStore } from '@/lib/store';

import { MobileNav } from './mobile-nav';
import { SearchModal } from './search-modal';

const navigation = [
  { name: 'Shop', href: '/shop' },
  { name: 'Men', href: '/category/men' },
  { name: 'Women', href: '/category/women' },
  { name: 'Accessories', href: '/category/accessories' },
];

export function Header(): React.JSX.Element {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { getTotalItems, openCart } = useCartStore();
  const [mounted, setMounted] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cartItemCount = mounted ? getTotalItems() : 0;
  const prevCountRef = useRef(cartItemCount);

  useEffect(() => {
    if (mounted && cartItemCount > prevCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = cartItemCount;
  }, [cartItemCount, mounted]);

  // Global Cmd+K / Ctrl+K listener for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
        {/* Main nav bar */}
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8 lg:px-12">
          {/* Left: Mobile hamburger + Logo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100 lg:hidden"
              onClick={() => setIsMobileNavOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="font-display text-primary text-xl font-bold tracking-tight">
              {SITE_NAME}
            </Link>
          </div>

          {/* Center: Desktop navigation */}
          <nav className="hidden lg:flex lg:items-center lg:gap-8" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="hover:text-primary text-sm font-medium text-neutral-600 transition-colors duration-150"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right: Search, Wishlist, Account, Cart */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100"
              aria-label="Search products"
            >
              <Search className="h-5 w-5" />
            </button>

            <Link
              href="/account/wishlist"
              className="hidden items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100 sm:inline-flex"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
            </Link>

            <Link
              href="/account"
              className="hidden items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100 sm:inline-flex"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>

            <Link
              href="/signup"
              className="hidden items-center rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-neutral-700 hover:bg-neutral-100 sm:inline-flex"
            >
              Sign up
            </Link>

            <motion.button
              type="button"
              onClick={openCart}
              whileTap={{ scale: 0.95 }}
              animate={isBouncing ? { y: [0, -6, 2, -2, 0] } : {}}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative inline-flex items-center justify-center rounded-md p-2 text-neutral-700 hover:bg-neutral-100"
              aria-label={`Shopping cart with ${cartItemCount} items`}
            >
              <ShoppingBag className="h-5 w-5" />
              <AnimatePresence>
                {cartItemCount > 0 && (
                  <motion.span
                    key={cartItemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: [1, 1.25, 1], opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="bg-primary text-primary-foreground absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-medium"
                  >
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* Mobile navigation drawer */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        navigation={navigation}
      />

      {/* Instant Search Command-K Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Shopping Bag Drawer */}
      <CartDrawer />
    </>
  );
}
