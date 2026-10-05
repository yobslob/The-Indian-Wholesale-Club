'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { formatUsd } from '@repo/shared/domain';

import { browserClient } from '@/lib/supabase/browser';

import type { RealtimeChannel } from '@supabase/supabase-js';

interface Entry {
  key: string;
  at: Date;
  text: string;
}

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Live (PR-7, C7): new orders and every order status change as they happen, through Supabase Realtime on `orders`.
 * RLS decides what arrives: only an admin's session receives other people's orders. Today's counts refresh with it.
 */
export function LiveFeed(): React.JSX.Element {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [live, setLive] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = browserClient();
    const refreshSoon = (): void => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 1500);
    };
    const channel: RealtimeChannel = client
      .channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as { id?: string; order_number?: string; status?: string; total_cents?: number };
        if (!row.id || !row.order_number) return;
        const text =
          payload.eventType === 'INSERT'
            ? `New order ${row.order_number}${typeof row.total_cents === 'number' ? ` · ${formatUsd(row.total_cents)}` : ''}`
            : `${row.order_number} is now ${row.status ?? 'updated'}`;
        setEntries((list) => [{ key: `${row.id}:${Date.now()}`, at: new Date(), text }, ...list].slice(0, 12));
        refreshSoon();
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void client.removeChannel(channel);
    };
  }, [router]);

  return (
    <section className="border-line space-y-2 rounded-md border p-4" aria-live="polite">
      <h2 className="font-medium">
        Live{' '}
        <span className={`text-sm font-normal ${live ? 'text-positive' : 'text-ink-muted'}`}>
          {live ? '· connected' : '· connecting…'}
        </span>
      </h2>
      {entries.length === 0 ? (
        <p className="text-ink-muted text-sm">New orders and status changes appear here as they happen.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map((e) => (
            <li key={e.key}>
              <span className="text-ink-muted">{time.format(e.at)}</span> · {e.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
