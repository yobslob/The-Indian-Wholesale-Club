import { listShipCountries } from '@repo/db/admin';

import { updateCountryAction } from '@/features/admin/actions/countries';
import { requireAdminPage } from '@/features/admin/guard';
import { Cell, input, PageHead, Table } from '@/features/admin/ui';

/**
 * D-208, Admin → Countries: every country ShipGlobal serves, the freight a kg its prices carry (ShipGlobal's cheapest 1 kg
 * quote rounded up to the next ₹500, read 2026-11-24; the US ₹2,000 by the founder's word) and whether IWC sells there
 * (D-209 closed the sanctioned and the empty ones). The service and days are ShipGlobal's, for the desk only.
 */
export default async function CountriesPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const countries = await listShipCountries(client);
  const open = countries.filter((c) => c.open).length;
  return (
    <div className="space-y-4">
      <PageHead title="Countries" />
      <p className="text-ink-muted text-sm">
        {open} of {countries.length} open. A price abroad = its US price with this freight a kg instead of ₹2,000 (D-208).
      </p>
      <Table head={['Country', 'ShipGlobal (1 kg)', 'Days', 'Freight ₹/kg', 'Open', '']}>
        {countries.map((c) => (
          <tr key={c.iso2}>
            <Cell>
              {c.name} <span className="text-ink-muted">{c.iso2}</span>
            </Cell>
            <Cell>
              {c.service ?? '—'}
              {c.inr_quote_1kg ? ` · ₹${c.inr_quote_1kg.toLocaleString('en-IN')}` : ''}
            </Cell>
            <Cell>{c.days_min ? `${c.days_min}–${c.days_max}` : '—'}</Cell>
            <Cell>
              <form action={updateCountryAction} id={`c-${c.iso2}`} className="contents">
                <input type="hidden" name="iso2" value={c.iso2} />
                <input name="rate" type="number" min={100} max={20000} step={500} defaultValue={c.inr_per_kg ?? ''} className={`${input} w-28`} />
              </form>
            </Cell>
            <Cell>
              <input type="checkbox" name="open" form={`c-${c.iso2}`} defaultChecked={c.open} aria-label={`${c.name} open`} />
            </Cell>
            <Cell>
              <button type="submit" form={`c-${c.iso2}`} className="font-ui text-sm font-semibold underline">
                Save
              </button>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
