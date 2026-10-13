import Link from 'next/link';

import { PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import { button, Cell, Field, input, Panel, rupees, Sub, Table, When } from '../../ui';

import { reviewSourceAction, saveSourcingSettingsAction, setShopAction } from './actions';

import type { Row } from '@repo/db';

/** The auto-sourcing page's parts that are only forms and tables (D-118). */

export function HeldPrices({
  held,
}: {
  held: {
    id: string;
    site: string;
    item_url: string;
    price_paise: number | null;
    review: string | null;
    review_price_paise: number | null;
    product: { id: string; name: string } | null;
    variant: { label: string } | null;
  }[];
}): React.JSX.Element | null {
  if (!held.length) return null;
  return (
    <Panel
      title={`Prices held for you (${held.length})`}
      note="the shop's price jumped; the piece stopped selling from that shop"
    >
      <Table
        head={['Product', 'Shop', { label: 'Was', right: true }, { label: 'Now', right: true }, '']}
      >
        {held.map((h) => (
          <tr key={h.id}>
            <Cell>
              {h.product ? (
                <Link href={`/admin/catalog/${h.product.id}`} className="font-semibold underline">
                  {h.product.name}
                </Link>
              ) : null}
              <Sub>{h.variant?.label}</Sub>
            </Cell>
            <Cell>
              <a href={h.item_url} target="_blank" rel="noreferrer" className="underline">
                {h.site}
              </a>
            </Cell>
            <Cell className="text-right">{rupees(h.price_paise)}</Cell>
            <Cell className="text-right font-semibold">{rupees(h.review_price_paise)}</Cell>
            <Cell>
              <div className="flex flex-wrap gap-3">
                <form action={reviewSourceAction.bind(null, h.id, true)}>
                  <button type="submit" className="min-h-11 underline">
                    Accept the new price
                  </button>
                </form>
                <form action={reviewSourceAction.bind(null, h.id, false)}>
                  <button type="submit" className="text-danger min-h-11 underline">
                    Stop using this shop
                  </button>
                </form>
              </div>
            </Cell>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

export function ShopsTable({ shops }: { shops: Row<'sourcing_shops'>[] }): React.JSX.Element {
  return (
    <Panel
      title="Shops"
      note="days: used only when a page shows no delivery date (empty: such pieces are never added)"
    >
      <Table head={['Shop', 'Sells', 'Days', 'On', 'Last good run', 'Last problem', '']}>
        {shops.map((s) => (
          <tr key={s.site}>
            <Cell>
              <b>{s.label}</b>
              <Sub>{s.site}</Sub>
            </Cell>
            <Cell>{s.product_types.map((t) => PRODUCT_TYPE_LABEL[t]).join(', ')}</Cell>
            <Cell>
              <input
                form={`shop-${s.site}`}
                name="delivery_days"
                type="number"
                min={0}
                max={30}
                defaultValue={s.delivery_days ?? ''}
                aria-label={`${s.label}: delivery days`}
                className={`${input} w-20`}
              />
            </Cell>
            <Cell>
              <input
                form={`shop-${s.site}`}
                name="is_enabled"
                type="checkbox"
                defaultChecked={s.is_enabled}
                aria-label={`${s.label}: searched`}
                className="h-5 w-5"
              />
            </Cell>
            <Cell>
              <When iso={s.last_ok_at} />
            </Cell>
            <Cell className="max-w-[260px]">
              {s.last_error ? (
                <>
                  <span className="text-danger">{s.last_error}</span>
                  <Sub>
                    <When iso={s.last_error_at} inline />
                  </Sub>
                </>
              ) : (
                '—'
              )}
            </Cell>
            <Cell>
              <form id={`shop-${s.site}`} action={setShopAction.bind(null, s.site)}>
                <button type="submit" className="min-h-11 underline">
                  Save
                </button>
              </form>
            </Cell>
          </tr>
        ))}
      </Table>
    </Panel>
  );
}

export function SettingsForm({ s }: { s: Row<'sourcing_settings'> }): React.JSX.Element {
  const num = (name: keyof Row<'sourcing_settings'>, label: string, min: number, max: number) => (
    <Field label={label}>
      <input
        name={name}
        type="number"
        required
        min={min}
        max={max}
        defaultValue={String(s[name])}
        className={input}
      />
    </Field>
  );
  return (
    <Panel title="Rules" note={<When iso={s.updated_at} inline />}>
      <form
        action={saveSourcingSettingsAction}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {num('max_delivery_days', 'Reaches the hub within (days)', 0, 15)}
        {num('listings_per_target', 'Listings per target', 1, 10)}
        {num('check_every_days', 'Check prices and stock every (days)', 1, 30)}
        {num('qty_per_variant', 'Pieces on sale per variant', 0, 99)}
        {num('targets_per_run', 'Targets per run', 1, 500)}
        {num('max_rise_pct', 'Hold a price that rises over (%)', 5, 1000)}
        {num('max_drop_pct', 'Hold a price that falls over (%)', 5, 95)}
        <label className="flex items-center gap-2 self-end pb-2 text-[14px]">
          <input
            name="auto_publish"
            type="checkbox"
            defaultChecked={s.auto_publish}
            className="h-5 w-5"
          />
          New listings go live by themselves when complete
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button type="submit" className={button}>
            Save rules
          </button>
        </div>
      </form>
    </Panel>
  );
}

export function RunsTable({ runs }: { runs: Row<'sourcing_runs'>[] }): React.JSX.Element {
  return (
    <Panel title="Recent runs" note="the runner on the PC at the hub (tools/sourcing-runner)">
      {runs.length === 0 ? (
        <p className="text-ink-muted">
          No run yet. Set up the runner at the hub: tools/sourcing-runner/README.md.
        </p>
      ) : (
        <Table
          head={['Finished', 'Targets', 'Added', 'Checked', 'Prices', 'Stock', 'Held', 'Problems']}
        >
          {runs.map((r) => (
            <tr key={r.id}>
              <Cell>
                <When iso={r.finished_at} />
              </Cell>
              <Cell>{r.targets_searched}</Cell>
              <Cell>{r.listings_added}</Cell>
              <Cell>{r.products_checked}</Cell>
              <Cell>{r.prices_changed}</Cell>
              <Cell>{r.stock_changed}</Cell>
              <Cell>{r.held}</Cell>
              <Cell>{r.errors}</Cell>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  );
}
