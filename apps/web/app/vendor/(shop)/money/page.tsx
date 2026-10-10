import { vendorMoney } from '@repo/db/vendor';
import { formatRupees, t } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { VendorTitle } from '@/features/vendor/shell';
import { shortDate } from '@/features/vendor/status';

/** Money (D-102): what IWC owes for collected pieces, in rupees, then the pieces collected and the payouts made. */
export default async function MoneyPage(): Promise<React.JSX.Element> {
  const { client, lang } = await requireVendorPage();
  const money = await vendorMoney(client);

  return (
    <>
      <VendorTitle>{t(lang, 'money')}</VendorTitle>
      <div className="border-brand bg-brand text-on-brand mb-5 rounded-[18px] border p-5">
        <p className="text-[15px] opacity-90">{t(lang, 'owed')}</p>
        <p className="text-[36px] font-bold tabular-nums">{formatRupees(money.owed_paise)}</p>
        {money.unpriced_pieces > 0 ? <p className="text-[14px] opacity-90">+ {money.unpriced_pieces} · {t(lang, 'amount_pending')}</p> : null}
      </div>

      <h2 className="font-heading mb-2 text-[18px] font-semibold">{t(lang, 'collected')}</h2>
      <ul className="mb-6 space-y-1.5">
        {money.collected.map((c, i) => (
          <li key={`${c.picked_at ?? ''}-${i}`} className="border-line bg-paper flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{c.product_name} · {c.variant_label} × {c.quantity}</span>
              <span className="text-ink-muted text-[13px]">{c.picked_at ? shortDate(c.picked_at, lang) : ''}{c.paid ? ` · ${t(lang, 'paid')}` : ''}</span>
            </span>
            <span className="shrink-0 text-[16px] font-semibold tabular-nums">{c.amount_paise === null ? '—' : formatRupees(c.amount_paise)}</span>
          </li>
        ))}
      </ul>

      <h2 className="font-heading mb-2 text-[18px] font-semibold">{t(lang, 'paid')}</h2>
      <ul className="space-y-1.5">
        {money.payouts.map((p, i) => (
          <li key={`${p.paid_at}-${i}`} className="border-line bg-paper flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2">
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{shortDate(p.paid_at, lang)}</span>
              <span className="text-ink-muted block truncate text-[13px]">{[p.method, p.reference].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="shrink-0 text-[17px] font-bold tabular-nums">{formatRupees(p.amount_paise)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
