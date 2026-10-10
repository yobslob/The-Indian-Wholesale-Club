import Link from 'next/link';

import { vendorKeepReady, vendorMoney, vendorPieces } from '@repo/db/vendor';
import { formatRupees, t } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { Icon, type IconName } from '@/features/vendor/icons';

function Tile({
  href,
  icon,
  title,
  hint,
  big,
  badge,
  primary,
}: {
  href: string;
  icon: IconName;
  title: string;
  hint: string;
  big?: string;
  badge?: string;
  primary?: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={`flex min-h-24 items-center gap-4 rounded-[18px] border p-4 ${primary ? 'border-brand bg-brand text-on-brand' : 'border-line bg-paper text-ink'}`}
    >
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${primary ? 'bg-on-brand/15' : 'bg-surface'}`}>
        <Icon name={icon} className="h-8 w-8" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-heading block text-[20px] font-semibold leading-tight">{title}</span>
        <span className={`block text-[14px] leading-snug ${primary ? 'opacity-90' : 'text-ink-muted'}`}>{hint}</span>
      </span>
      {big ? <span className="text-[22px] font-bold tabular-nums">{big}</span> : null}
      {badge ? <span className="bg-danger text-paper rounded-full px-2.5 py-1 text-[14px] font-bold">{badge}</span> : null}
    </Link>
  );
}

/** Home (D-103): what to do now, as four big tiles. Adding a piece first; the counts say what waits. */
export default async function VendorHome(): Promise<React.JSX.Element> {
  const { client, me, lang } = await requireVendorPage();
  const [ready, money, pieces] = await Promise.all([vendorKeepReady(client), vendorMoney(client), vendorPieces(client, 0, 50)]);
  const toKeep = ready.reduce((n, r) => n + r.quantity, 0);
  const retakes = pieces.items.filter((p) => p.kind === 'submission' && p.status === 'needs_retake').length;

  return (
    <div className="space-y-3">
      <h1 className="font-heading mb-2 text-[24px] font-semibold">{t(lang, 'hello', { name: me.owner_name ?? me.shop_name })}</h1>
      <Tile href="/vendor/new" icon="camera" title={t(lang, 'add_piece')} hint={t(lang, 'add_piece_hint')} primary />
      <Tile href="/vendor/ready" icon="box" title={t(lang, 'keep_ready')} hint={t(lang, 'keep_ready_hint')} big={toKeep > 0 ? String(toKeep) : undefined} />
      <Tile
        href="/vendor/pieces"
        icon="pieces"
        title={t(lang, 'my_pieces')}
        hint={retakes > 0 ? t(lang, 'status_needs_retake') : t(lang, 'my_pieces_hint')}
        badge={retakes > 0 ? String(retakes) : undefined}
      />
      <Tile href="/vendor/money" icon="rupee" title={t(lang, 'money')} hint={t(lang, 'owed')} big={formatRupees(money.owed_paise)} />
    </div>
  );
}
