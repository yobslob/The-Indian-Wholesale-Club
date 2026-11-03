'use client';

import { choose, displayOption, displayTitle, isAvailable, sizeLabel, type OptionAxis, type Selection } from '@repo/shared/domain';

import type { Variant } from '@repo/db/store';

const pillClass = (selected: boolean, out: boolean): string =>
  `font-ui bg-paper min-h-11 rounded-pill border px-4 text-sm font-medium ${
    selected ? 'border-ink shadow-[inset_0_0_0_1px_theme(colors.ink)]' : 'border-line'
  } ${out ? 'line-through opacity-60' : ''}`;
const legendClass = 'font-ui text-ink-muted mb-2 text-[11px] font-semibold uppercase tracking-[0.16em]';

/** A value as the page shows it: a size in its one spelling, anything else title-cased when the shop wrote it lower case (B-3, B-9). */
const shown = (key: OptionAxis['key'], value: string): string => (key === 'size' ? sizeLabel(value) : displayTitle(value));

/**
 * The product page's choices (split from add-to-cart.tsx): one row per option the variants differ on (`optionAxes`,
 * sizes in size order), else one button per variant. D-140 (L3): until the customer taps one, the row they must
 * choose from says "choose one" and no button is pressed.
 */
export function OptionRows({
  variants,
  axes,
  selection,
  variantId,
  picked,
  inStock,
  onSelect,
}: {
  variants: Variant[];
  axes: OptionAxis[];
  selection: Selection;
  variantId: string;
  picked: boolean;
  inStock: (v: Variant) => boolean;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const sizeAxis = axes.some((a) => a.key === 'size');
  return (
    <>
      {axes.map((axis) => {
        const open = !picked && axis.key === (sizeAxis ? 'size' : axis.key);
        const current = selection[axis.key];
        return (
          <fieldset key={axis.key}>
            <legend className={legendClass}>
              {axis.label}:{' '}
              <span className={`normal-case tracking-normal ${open ? 'text-caution' : 'text-ink'}`}>
                {open ? 'choose one' : current ? shown(axis.key, current) : null}
              </span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {axis.values.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    const next = choose(variants, axes, selection, axis.key, value, inStock);
                    if (next) onSelect(next.id);
                  }}
                  aria-pressed={!open && current === value}
                  className={pillClass(!open && current === value, !isAvailable(variants, axes, selection, axis.key, value, inStock))}
                >
                  {shown(axis.key, value)}
                </button>
              ))}
            </div>
          </fieldset>
        );
      })}
      {axes.length === 0 && variants.length > 1 ? (
        <fieldset>
          <legend className={legendClass}>Option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                aria-pressed={picked && v.id === variantId}
                className={pillClass(picked && v.id === variantId, !inStock(v))}
              >
                {displayOption(v.label)}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
