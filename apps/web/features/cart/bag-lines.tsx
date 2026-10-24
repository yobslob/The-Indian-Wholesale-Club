'use client';

import Link from 'next/link';

import { arrivalLine, bagGroups, bagShipmentState, formatUsd, productPath, quickGapLine } from '@repo/shared/domain';

import { StorePhoto } from '@/features/catalog/store-photo';
import { mediaUrl } from '@/lib/site';

import { useBagCharges } from './charges';
import { MAX_QTY_PER_LINE } from './limits';
import { useCart, type CartLine } from './store';

const stepButton = 'grid size-11 place-items-center text-lg font-medium disabled:cursor-default disabled:text-line';

/** − / number / + within 1 – 10 (D-086); Remove takes a line out. */
function Stepper({ line }: { line: CartLine }): React.JSX.Element {
  const setQuantity = useCart((s) => s.setQuantity);
  return (
    <div className="border-line bg-paper font-ui inline-flex h-11 items-center rounded-pill border" role="group" aria-label={`Quantity of ${line.productName}`}>
      <button type="button" className={stepButton} aria-label="One fewer" disabled={line.quantity <= 1} onClick={() => setQuantity(line.variantId, line.quantity - 1)}>
        −
      </button>
      <output className="min-w-[22px] text-center text-[15px] font-semibold" aria-live="polite">
        {line.quantity}
      </output>
      <button type="button" className={stepButton} aria-label="One more" disabled={line.quantity >= MAX_QTY_PER_LINE} onClick={() => setQuantity(line.variantId, line.quantity + 1)}>
        +
      </button>
    </div>
  );
}

export function LinePhoto({ path, href, className }: { path: string | null; href?: string; className: string }): React.JSX.Element {
  const box = `bg-land relative block aspect-[3/4] flex-none overflow-hidden ${className}`;
  const img = path ? <StorePhoto src={mediaUrl(path)} alt="" sizes="72px" className="object-cover" /> : null;
  return href ? (
    <Link href={href} className={box} tabIndex={-1} aria-hidden="true">
      {img}
    </Link>
  ) : (
    <span className={box} aria-hidden="true">
      {img}
    </span>
  );
}

/**
 * The bag's lines (D-086): a small photo (it and the name open the product), the option and state, the stepper, the
 * line's price and Remove. `compact` is the panel's and phones' two-row layout. Prices are for display only:
 * checkout re-prices every line on the server (D-038). D-154: once the bag holds 7-day pieces, its lines sit under
 * their arrival dates ("Shipment 1 · Arrives by Fri, Oct 30", "Shipment 2 · Arrives Nov 3 – Nov 7"), and under the
 * 7-day line the bag says how much more brings them in 7 days, with the way to the 7-day store.
 */
export function BagLines({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const facts = useBagCharges()?.shipments ?? null;
  const state = bagShipmentState(facts);
  if (state === 'none') return <LineList lines={lines} compact={compact} top={!compact} />;
  // a bag of only 7-day pieces under the line: its summary's one goal says it (bag-goal.ts), not a second line here
  const onlyQuick = facts !== null && lines.every((l) => facts.quickIds.includes(l.variantId));
  const gap = state === 'under' && !onlyQuick ? quickGapLine(facts) : null;
  return (
    <div className="font-ui">
      {bagGroups(lines, facts).map((g) => {
        const when = arrivalLine(g.from, g.to);
        return (
          <section key={g.seq ?? 0} aria-label={g.seq ? `Shipment ${g.seq}` : 'Your bag'} className="pt-3 first:pt-0">
            <h3 className={`m-0 pb-2 text-[14px] font-semibold ${g.kind === 'quick' ? 'text-brand' : 'text-ink'}`}>
              {[g.seq ? `Shipment ${g.seq}` : null, when].filter(Boolean).join(' · ')}
              <span className="text-ink-muted font-normal"> · for most US addresses</span>
            </h3>
            <LineList lines={g.lines} compact={compact} top />
          </section>
        );
      })}
      {gap ? (
        <p className="m-0 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-3 text-[13.5px]">
          <span className="text-brand font-semibold">{gap}</span>
          <Link href="/7-day-delivery" className="font-medium underline underline-offset-[3px]">
            Shop the 7-day store
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function LineList({ lines, compact, top }: { lines: CartLine[]; compact: boolean; top: boolean }): React.JSX.Element {
  const remove = useCart((s) => s.remove);
  const grid = compact
    ? 'grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:"pic_nm_pr""pic_step_rm"]'
    : 'grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:"pic_nm_pr""pic_step_rm"] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] sm:[grid-template-areas:"pic_nm_step_pr_rm"]';
  return (
    <ul className={`border-line m-0 list-none p-0 ${top ? 'border-t' : ''}`}>      {lines.map((line) => {
        const href = productPath(line.regionSlug, line.productSlug);
        return (
          <li key={line.variantId} className={`border-line font-ui grid items-center gap-x-5 gap-y-3 border-b py-4 ${grid}`}>
            <LinePhoto path={line.imagePath} href={href} className={`rounded-xl [grid-area:pic] ${compact ? 'w-16' : 'w-16 sm:w-[72px]'}`} />
            <div className="min-w-0 [grid-area:nm]">
              <Link href={href} className="text-[15px] font-semibold leading-snug hover:underline">
                {line.productName}
              </Link>
              <span className="text-ink-muted mt-0.5 block text-sm">
                {line.variantLabel}
                {line.regionName ? ` · ${line.regionName}` : null}
              </span>
            </div>
            <div className="justify-self-start [grid-area:step]">
              <Stepper line={line} />
            </div>
            <span className="min-w-[70px] text-right text-[15px] font-medium [grid-area:pr]">
              {formatUsd(line.unitPriceCents * line.quantity)}
            </span>
            <button
              type="button"
              onClick={() => remove(line.variantId)}
              className="min-h-11 justify-self-end text-sm font-medium underline underline-offset-[3px] [grid-area:rm]"
              aria-label={`Remove ${line.productName}`}
            >
              Remove
            </button>
          </li>
        );
      })}
    </ul>
  );
}
