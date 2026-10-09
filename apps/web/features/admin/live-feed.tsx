'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { browserClient } from '@/lib/supabase/browser';

import { ORDER_STATUS } from './chips';

import type { Enum } from '@repo/db';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Entry {
  key: string;
  at: Date;
  text: string;
}

/** The admin's one live state, shared by the top bar's dot and Today's feed (a tiny store, no context). */
type LiveState = { live: boolean; entries: Entry[] };
const OFFLINE: LiveState = { live: false, entries: [] };
let state = OFFLINE;
const listeners = new Set<() => void>();
function update(patch: (s: LiveState) => Partial<LiveState>): void {
  state = { ...state, ...patch(state) };
  listeners.forEach((l) => l());
}
function useLive(): LiveState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => OFFLINE,
  );
}

/**
 * Live (PR-7, C7): one Supabase Realtime channel on `orders` for the whole admin (mounted once by the frame), so the
 * top bar's dot and Today's feed share it. RLS decides what arrives: only an admin's session receives other people's orders. On Today the
 * counts refresh with each change.
 */
export function LiveChannel(): null {
  const router = useRouter();
  const pathname = usePathname();
  const onToday = useRef(pathname === '/admin');
  onToday.current = pathname === '/admin';
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = browserClient();
    const refreshSoon = (): void => {
      if (!onToday.current) return;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 1500);
    };
    const channel: RealtimeChannel = client
      .channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { id?: string; order_number?: string; status?: Enum<'order_status'>; total_cents?: number };
        if (!row.id || !row.order_number) return;
        const text =
          payload.eventType === 'INSERT'
            ? `New order ${row.order_number}${typeof row.total_cents === 'number' ? ` · ${formatUsd(row.total_cents)}` : ''}`
            : `${row.order_number} is now ${row.status ? ORDER_STATUS[row.status][0] : 'updated'}`;
        update((s) => ({ entries: [{ key: `${row.id}:${Date.now()}`, at: new Date(), text }, ...s.entries].slice(0, 12) }));
        refreshSoon();
      })
      .subscribe((status) => update(() => ({ live: status === 'SUBSCRIBED' })));
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void client.removeChannel(channel);
      update(() => ({ live: false }));
    };
  }, [router]);

  return null;
}

/** The top bar's dot: green and "Live" once connected. */
export function LiveDot(): React.JSX.Element {
  const { live } = useLive();
  return (
    <span className={`font-ui inline-flex items-center gap-1.5 text-[12px] font-semibold ${live ? 'text-positive' : 'text-ink-muted'}`}>
      <i className={`h-2 w-2 rounded-full ${live ? 'bg-positive shadow-[0_0_0_3px_rgb(22_101_52/0.15)]' : 'bg-line'}`} />
      {live ? 'Live' : 'Connecting'}
    </span>
  );
}

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/** Today's "Live orders": new orders and status changes as they happen (the browser's own clock for the time). */
export function LiveFeed(): React.JSX.Element {
  const { live, entries } = useLive();
  return (
    <section className="border-line bg-paper rounded-[14px] border px-[18px] py-4" aria-live="polite">
      <h2 className="font-heading mb-2 flex items-center gap-2 text-[15px] font-semibold">
        <i className={`h-2 w-2 rounded-full ${live ? 'bg-positive' : 'bg-line'}`} aria-hidden="true" />
        Live orders
        <small className="font-ui text-ink-muted ml-auto text-[12px] font-medium">{live ? '· connected' : '· connecting…'}</small>
      </h2>
      {entries.length === 0 ? (
        <p className="text-ink-muted text-[13.5px]">New orders and status changes appear here as they happen.</p>
      ) : (
        <ul>
          {entries.map((e) => (
            <li key={e.key} className="border-line flex gap-2.5 border-b py-[9px] text-[13.5px] leading-[1.35] last:border-0">
              <time className="text-ink-muted whitespace-nowrap text-[12px]">{time.format(e.at)}</time>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
