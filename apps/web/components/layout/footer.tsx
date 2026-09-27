'use client';

import Link from 'next/link';
import { useState } from 'react';

import { SITE_NAME, SUPPORT_EMAIL } from '@repo/shared/constants';


const footerNavigation = {
  shop: [
    { name: 'All Products', href: '/shop' },
    { name: 'Men', href: '/category/men' },
    { name: 'Women', href: '/category/women' },
    { name: 'Accessories', href: '/category/accessories' },
    { name: 'New Arrivals', href: '/shop?sort=newest' },
  ],
  help: [
    { name: 'FAQ', href: '/faq' },
    { name: 'Shipping & Returns', href: '/shipping-returns' },
    { name: 'Size Guide', href: '/size-guide' },
    { name: 'Contact Us', href: '/contact' },
    { name: 'Order Status', href: '/order-lookup' },
  ],
  company: [
    { name: 'About', href: '/about' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
  ],
};

export function Footer(): React.JSX.Element {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribeError(null);

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setSubscribeError(body?.error ?? 'Subscription failed. Please try again.');
        return;
      }

      setSubscribed(true);
      setEmail('');
    } catch {
      setSubscribeError('Subscription failed. Please check your connection.');
    }
  };


  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      {/* Main footer content */}
      <div className="mx-auto max-w-screen-2xl px-4 py-12 md:px-8 md:py-16 lg:px-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="font-display text-primary text-xl font-bold tracking-tight">
              {SITE_NAME}
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600">
              Premium essentials for the modern wardrobe. Thoughtfully designed, responsibly made.
            </p>
            <p className="mt-4 text-sm text-neutral-500">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-primary transition-colors">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>

          {/* Shop links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Shop
            </h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.shop.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="hover:text-primary text-sm text-neutral-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Help
            </h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.help.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="hover:text-primary text-sm text-neutral-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links + Newsletter */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {footerNavigation.company.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="hover:text-primary text-sm text-neutral-600 transition-colors"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>

            {/* Newsletter */}
            <div className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-900">
                Stay in Touch
              </h3>
              {subscribed ? (
                <p className="mt-3 text-xs font-medium text-emerald-600">
                  Subscribed! Thank you for joining ROOT.
                </p>
              ) : (
                <form className="mt-3 flex gap-2" onSubmit={handleSubscribe}>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="h-10 w-full min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-900"
                    aria-label="Email address for newsletter"
                  />
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground h-10 shrink-0 rounded-md px-4 text-sm font-medium transition-colors hover:bg-neutral-800"
                  >
                    Join
                  </button>
                </form>
              )}
              {subscribeError && !subscribed && (
                <p className="mt-2 text-xs font-medium text-red-600">{subscribeError}</p>
              )}
              <p className="mt-2 text-xs text-neutral-500">No spam. Unsubscribe anytime.</p>
            </div>

          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-neutral-500 sm:flex-row md:px-8 lg:px-12">
          <p>
            &copy; {currentYear} {SITE_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-primary transition-colors">
              Terms
            </Link>
            <Link href="/shipping-returns" className="hover:text-primary transition-colors">
              Shipping
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
