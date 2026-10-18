'use client';

import Link from 'next/link';
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

/** The admin's one live state, shared by the top bar's dot, Today's feed and the new-order toast (a tiny store, no context). */
type LiveState = { live: boolean; entries: Entry[]; toast: { id: string; text: string } | null };
const OFFLINE: LiveState = { live: false, entries: [], toast: null };
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
        // D-140 (A1): a new order is announced on every admin screen, with a short chime
        if (payload.eventType === 'INSERT') {
          update(() => ({ toast: { id: row.id!, text } }));
          chime();
        }
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

/** Two soft notes (Web Audio, no file to load). Browsers allow it once the admin has clicked on the page. */
function chime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [659.25, 987.77].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.16;
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    // no sound is fine: the toast still shows
  }
}

/** "New order …" at the bottom of any admin screen for a few seconds, linking to the order (D-140, A1). */
export function NewOrderToast(): React.JSX.Element | null {
  const { toast } = useLive();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => update(() => ({ toast: null })), 9000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div role="status" className="bg-ink text-paper rise-in font-ui fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-[12px] px-4 py-3 text-[14px] shadow-xl print:hidden">
      <i className="bg-positive h-2 w-2 flex-none rounded-full" aria-hidden="true" />
      <Link href={`/admin/orders/${toast.id}`} className="font-semibold underline" onClick={() => update(() => ({ toast: null }))}>
        {toast.text}
      </Link>
      <button type="button" aria-label="Dismiss" onClick={() => update(() => ({ toast: null }))} className="grid h-11 w-11 place-items-center text-[18px] md:h-8 md:w-8">
        ×
      </button>
    </div>
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
