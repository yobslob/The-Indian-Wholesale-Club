import Link from 'next/link';

import { listVendorSubmissions } from '@repo/db/admin';

import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { signedUrls } from '@/features/admin/signed';
import { Cell, Empty, PageHead, rupees, Table, When } from '@/features/admin/ui';

const STATE: Record<string, [string, 'ok' | 'warn' | 'mute' | 'bad']> = {
  photos_ready: ['Photos ready', 'ok'],
  waiting: ['Making photos', 'warn'],
  needs_retake: ['Retake asked', 'mute'],
};

/** Vendor pieces (D-103): what shops sent, photos made first; open one to pick the photos and publish. */
export default async function VendorPiecesPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const pieces = await listVendorSubmissions(client);
  const fronts = await signedUrls(client, 'vendor-uploads', pieces.map((p) => p.photos?.find((ph) => ph.view === 'front')?.storage_path ?? ''));
  const order = ['photos_ready', 'waiting', 'needs_retake'];
  const sorted = [...pieces].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  return (
    <div className="space-y-5">
      <PageHead title="Vendor pieces" sub="Sent by shops (D-102). Pick the photos, check the words, publish." />
      {sorted.length === 0 ? (
        <Empty>Nothing waiting.</Empty>
      ) : (
        <Table head={['Piece', 'Shop', 'Sizes', { label: 'Shop price', right: true }, 'Sent', 'State']}>
          {sorted.map((p) => {
            const front = fronts.get(p.photos?.find((ph) => ph.view === 'front')?.storage_path ?? '');
            const sizes = (p.variants as { label: string; qty: number }[]).map((v) => `${v.label}×${v.qty}`).join(', ');
            const [label, tone] = STATE[p.status] ?? [p.status, 'mute'];
            return (
              <tr key={p.id}>
                <Cell>
                  <Link href={`/admin/vendor-pieces/${p.id}`} className="flex items-center gap-2.5">
                    <span className="bg-surface h-14 w-11 shrink-0 overflow-hidden rounded-md">
                      {/* eslint-disable-next-line @next/next/no-img-element -- private signed thumbnail */}
                      {front ? <img src={front} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <b className="font-semibold underline">{p.category?.name ?? '—'}</b>
                  </Link>
                </Cell>
                <Cell>{p.vendor?.shop_name ?? '—'}<span className="text-ink-muted block text-[12px]">{p.vendor?.region?.name}</span></Cell>
                <Cell>{sizes}</Cell>
                <Cell className="text-right">{rupees(p.shop_price_paise)}</Cell>
                <Cell><When iso={p.submitted_at} /></Cell>
                <Cell><Chip tone={tone}>{label}</Chip></Cell>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
