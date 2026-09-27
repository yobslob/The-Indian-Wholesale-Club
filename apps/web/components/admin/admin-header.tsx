'use client';

import { Menu, Shield, User } from 'lucide-react';
import React from 'react';

interface AdminHeaderProps {
  title?: string;
  onOpenMobileMenu?: () => void;
  userEmail?: string;
}

export function AdminHeader({
  title = 'Dashboard',
  onOpenMobileMenu,
  userEmail = 'admin@root.com',
}: AdminHeaderProps): React.JSX.Element {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Session Badge */}
        <div className="hidden items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 sm:flex">
          <Shield className="h-3.5 w-3.5 text-zinc-600" />
          <span>Admin Portal</span>
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2 border-l border-zinc-200 pl-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden text-left md:block">
            <div className="text-xs font-bold leading-tight text-zinc-900 truncate max-w-[150px]">
              {userEmail}
            </div>
            <div className="font-mono text-[10px] text-zinc-500">Authorized Operator</div>
          </div>
        </div>
      </div>
    </header>
  );
}

