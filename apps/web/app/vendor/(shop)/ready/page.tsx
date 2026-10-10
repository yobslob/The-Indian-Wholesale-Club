import { vendorKeepReady } from '@repo/db/vendor';
import { t } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { photoUrls } from '@/features/vendor/photos';
import { VendorTitle } from '@/features/vendor/shell';
import { shortDate } from '@/features/vendor/status';

/**
 * Keep ready (D-102): pieces customers ordered that IWC will collect, with the size, how many and from when. Never
 * who bought them (INV-10).
 */
export default async function KeepReadyPage(): Promise<React.JSX.Element> {
  const { client, lang } = await requireVendorPage();
  const rows = await vendorKeepReady(client);
  const photos = await photoUrls(client, rows.map((r) => ({ bucket: 'product-media' as const, path: r.photo_path })));

  return (
    <>
      <VendorTitle>{t(lang, 'keep_ready')}</VendorTitle>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[17px]">{t(lang, 'nothing_ready')}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.product_id}-${r.variant_label}-${r.collect_after ?? 'now'}`} className="border-line bg-paper flex items-center gap-3 rounded-[14px] border p-2.5">
              <span className="bg-surface h-20 w-16 shrink-0 overflow-hidden rounded-[10px]">
                {photos[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small thumbnails of store photos
                  <img src={photos[i] ?? ''} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold">{r.product_name}</span>
                <span className="text-ink-muted block text-[14px]">{r.variant_label}</span>
                <span className="block text-[14px]">{r.collect_after ? t(lang, 'collect_after', { date: shortDate(r.collect_after, lang) }) : t(lang, 'collect_soon')}</span>
              </span>
              <span className="bg-brand text-on-brand flex h-12 min-w-12 items-center justify-center rounded-full px-2 text-[20px] font-bold tabular-nums">{r.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
