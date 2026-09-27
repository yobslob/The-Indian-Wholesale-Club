'use client';

import {
  BarChart3,
  Boxes,
  ExternalLink,
  LayoutDashboard,
  Shirt,
  ShoppingBag,
  Tag,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const NAV_ITEMS = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Products', href: '/admin/products', icon: Shirt },
  { label: 'Inventory', href: '/admin/inventory', icon: Boxes },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Promo Codes', href: '/admin/promo-codes', icon: Tag },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
];

interface AdminSidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function AdminSidebar({ className = '', onNavigate }: AdminSidebarProps): React.JSX.Element {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full w-64 shrink-0 flex-col justify-between border-r border-zinc-800 bg-zinc-950 text-white ${className}`}
    >
      <div>
        {/* Brand header */}
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800/80 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-sm font-bold tracking-widest text-zinc-950">
            R
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white">ROOT Admin</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Logistics & Control
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'shadow-2xs bg-zinc-800 font-semibold text-white'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer controls & links */}
      <div className="space-y-3 border-t border-zinc-800/80 p-4">
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="h-3.5 w-3.5" />
            View Storefront
          </span>
          <span className="font-mono text-[10px] text-zinc-500">Live</span>
        </Link>
      </div>
    </aside>
  );
}
