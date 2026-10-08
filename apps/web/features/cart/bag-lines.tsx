'use client';

import Image from 'next/image';
import Link from 'next/link';

import { formatUsd } from '@repo/shared/domain';

import { mediaUrl } from '@/lib/site';

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
  const img = path ? <Image src={mediaUrl(path)} alt="" fill sizes="72px" className="object-cover" /> : null;
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
 * checkout re-prices every line on the server (D-038).
 */
export function BagLines({ compact = false }: { compact?: boolean }): React.JSX.Element {
  const lines = useCart((s) => s.lines);
  const remove = useCart((s) => s.remove);
  const grid = compact
    ? 'grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:"pic_nm_pr""pic_step_rm"]'
    : 'grid-cols-[auto_minmax(0,1fr)_auto] [grid-template-areas:"pic_nm_pr""pic_step_rm"] sm:grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] sm:[grid-template-areas:"pic_nm_step_pr_rm"]';
  return (
    <ul className={`border-line m-0 list-none p-0 ${compact ? '' : 'border-t'}`}>
      {lines.map((line) => {
        const href = `/states/${line.regionSlug}/${line.productSlug}`;
        return (
          <li key={line.variantId} className={`border-line font-ui grid items-center gap-x-5 gap-y-3 border-b py-4 ${grid}`}>
            <LinePhoto path={line.imagePath} href={href} className={`rounded-xl [grid-area:pic] ${compact ? 'w-16' : 'w-16 sm:w-[72px]'}`} />
            <div className="min-w-0 [grid-area:nm]">
              <Link href={href} className="text-[15px] font-semibold leading-snug hover:underline">
                {line.productName}
              </Link>
              <span className="text-ink-muted mt-0.5 block text-sm">
                {line.variantLabel} · {line.regionName}
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
