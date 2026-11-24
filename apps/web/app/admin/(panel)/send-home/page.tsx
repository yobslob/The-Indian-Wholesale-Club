import { getSendHomeQueue, SEND_HOME_TABS, type DeskGift, type SendHomeTab } from '@repo/db/admin';
import { formatInr } from '@repo/shared/domain';

import { checkRateAction } from '@/features/admin/actions/send-home';
import { requireAdminPage } from '@/features/admin/guard';
import { GiftCard } from '@/features/admin/send-home/gift-card';
import { Empty, PageHead, secondaryButton, Tabs } from '@/features/admin/ui';
import { SEND_HOME_WORDS } from '@/features/send-home/words';

type SearchParams = Promise<{ tab?: string }>;
const W = SEND_HOME_WORDS.admin;

function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}

function heldNote(gift: DeskGift, now: number): string | null {
  if (!gift.held) return null;
  if (gift.status === 'on_hold' && gift.hold_until && Date.parse(gift.hold_until) > now) {
    const when = new Date(gift.hold_until).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    return W.heldUntil(when);
  }
  return W.heldDispute;
}

/**
 * D-205, the India desk's Send home queue (plan §4.8, phone first): To send (oldest first), On hold (a first order's
 * hold, or an open dispute), Sent and Couldn't send. Paid by hand from the desk's own UPI app (rule 10).
 */
export default async function SendHomePage({ searchParams }: { searchParams: SearchParams }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const wanted = (await searchParams).tab;
  const tab: SendHomeTab = SEND_HOME_TABS.find((t) => t === wanted) ?? 'to_send';
  const queue = await getSendHomeQueue(client, tab);
  const now = new Date().getTime();
  const tabs = SEND_HOME_TABS.map((key) => ({
    key,
    href: key === 'to_send' ? '/admin/send-home' : `/admin/send-home?tab=${key}`,
    label: W.tabs[key],
    count: key === 'to_send' ? queue.counts.to_send : key === 'on_hold' ? queue.counts.on_hold : undefined,
  }));
  return (
    <>
      <PageHead
        title={W.title}
        sub={tab === 'to_send' ? `${W.oldestFirst} · ${W.today(formatInr(queue.counts.to_send_inr_paise))}` : undefined}
        actions={
          <form action={checkRateAction}>
            <button type="submit" className={secondaryButton}>
              {W.checkRate}
            </button>
          </form>
        }
      />
      <p className="font-ui text-ink-muted -mt-2 mb-4 text-[13px]">
        {queue.rate.inr_per_usd !== null && queue.rate.at
          ? W.rateLine(queue.rate.inr_per_usd.toFixed(2), ago(queue.rate.at, now), queue.rate.keep_pct ?? 0)
          : W.noRate}{' '}
        {queue.rate.live ? W.open : queue.rate.open ? W.closedOld : W.closed}
      </p>
      <Tabs items={tabs} current={tab} />
      {queue.gifts.length === 0 ? (
        <Empty>{W.empty}</Empty>
      ) : (
        <div className="grid max-w-[560px] gap-3">
          {queue.gifts.map((g) => (
            <GiftCard key={g.id} gift={g} paidAgo={ago(g.paid_at, now)} heldNote={heldNote(g, now)} />
          ))}
        </div>
      )}
    </>
  );
}
