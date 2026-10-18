import { formatInr, formatUsd } from '@repo/shared/domain';

import type { OrderMoney } from './money';

const pct = (n: number | null): string => (n === null ? '' : ` (${n}%)`);

/** The order's cost and margins under its Money panel (D-140, F4): invoice B and C, A − B and A − C. Admins only. */
export function MoneyLines({ money }: { money: OrderMoney }): React.JSX.Element {
  return (
    <dl className="border-line mt-3 grid gap-1.5 border-t pt-3 text-[14px] leading-[1.3] [&>div]:flex [&>div]:justify-between [&>div]:gap-3 [&_dd]:m-0 [&_dd]:text-right [&_dt]:text-ink-muted">
      <div>
        <dt>
          Our cost (B){' '}
          <small className={money.b.final ? 'text-positive' : 'text-caution'}>{money.b.final ? 'final' : 'provisional'}</small>
        </dt>
        <dd>
          {formatUsd(money.b.cents)}
          <small className="text-ink-muted block text-[12px]">{formatInr(money.b.paise)}</small>
        </dd>
      </div>
      {money.b.missing > 0 ? (
        <p className="text-caution text-[12.5px]">
          {money.b.missing} piece{money.b.missing === 1 ? ' has' : 's have'} no shop price or weight: left out of B.
        </p>
      ) : null}
      {money.c ? (
        <div>
          <dt>
            Shop bill (C) <small className={money.c.final ? 'text-positive' : 'text-ink-muted'}>{money.c.final ? 'final' : 'draft'}</small>
          </dt>
          <dd>
            {formatUsd(money.c.cents)}
            <small className="text-ink-muted block text-[12px]">{formatInr(money.c.paise)}</small>
          </dd>
        </div>
      ) : null}
      <div className="font-semibold [&>dt]:!text-ink">
        <dt>Margin over our cost</dt>
        {money.marginB ? (
          <dd className={money.marginB.cents < 0 ? 'text-danger' : 'text-positive'}>
            {formatUsd(money.marginB.cents)}
            {pct(money.marginB.pct)}
          </dd>
        ) : (
          <dd className="text-ink-muted font-normal">not known yet</dd>
        )}
      </div>
      {money.marginC ? (
        <div>
          <dt>Over the shop bill</dt>
          <dd className={money.marginC.cents < 0 ? 'text-danger' : ''}>
            {formatUsd(money.marginC.cents)}
            {pct(money.marginC.pct)}
          </dd>
        </div>
      ) : null}
      <p className="text-ink-muted text-[12px]">Margins are on what was paid, less tax and refunds.</p>
    </dl>
  );
}
