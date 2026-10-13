/**
 * Option pickers for a product's variants (product page, web and app). A variant's `options` holds what tells it
 * apart: colour and size for clothing, flavour or type and pack size for food, style for anything else
 * (`{ colour: 'Maroon', size: 'M' }`, `{ flavour: 'Malai', pack: '500 g' }`, D-118); a product with many of each
 * shows one row of choices per option instead of one long list. Pure functions, no I/O.
 */

/** In the order the rows show. */
export const OPTION_KEYS = ['colour', 'flavour', 'style', 'pack', 'size'] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];
export type Selection = Partial<Record<OptionKey, string>>;

interface WithOptions {
  options: Record<string, unknown>;
}

export interface OptionAxis {
  key: OptionKey;
  label: string;
  values: string[];
}

export const OPTION_LABEL: Record<OptionKey, string> = {
  colour: 'Colour',
  flavour: 'Flavour',
  style: 'Type',
  pack: 'Pack',
  size: 'Size',
};

const valueOf = (v: WithOptions, key: OptionKey): string | undefined =>
  typeof v.options[key] === 'string' ? (v.options[key] as string) : undefined;

/**
 * The axes to show: each option only when variants differ on it, values in variant order. Empty when
 * the axes can't tell every variant apart (then the product page falls back to one button per variant).
 */
export function optionAxes(variants: WithOptions[]): OptionAxis[] {
  const axes = OPTION_KEYS.map((key) => ({
    key,
    label: OPTION_LABEL[key],
    values: [...new Set(variants.map((v) => valueOf(v, key)).filter((x): x is string => x !== undefined))],
  })).filter((a) => a.values.length > 1);
  if (axes.length === 0) return [];
  const keys = new Set(variants.map((v) => axes.map((a) => valueOf(v, a.key) ?? '').join('\u0000')));
  return keys.size === variants.length ? axes : [];
}

/** The selection a variant stands for, on the given axes. */
export function selectionOf(variant: WithOptions, axes: OptionAxis[]): Selection {
  return Object.fromEntries(axes.map((a) => [a.key, valueOf(variant, a.key)]));
}

/** The variant matching every chosen value, if there is one. */
export function findVariant<T extends WithOptions>(variants: T[], axes: OptionAxis[], chosen: Selection): T | undefined {
  return variants.find((v) => axes.every((a) => valueOf(v, a.key) === chosen[a.key]));
}

/**
 * Picking `value` on one axis: keep the other choices when that combination exists, otherwise move to the first
 * variant with that value, preferring one in stock.
 */
export function choose<T extends WithOptions>(
  variants: T[],
  axes: OptionAxis[],
  current: Selection,
  key: OptionKey,
  value: string,
  inStock: (v: T) => boolean,
): T | undefined {
  const exact = findVariant(variants, axes, { ...current, [key]: value });
  if (exact) return exact;
  const withValue = variants.filter((v) => valueOf(v, key) === value);
  return withValue.find(inStock) ?? withValue[0];
}

/** Whether a value can be bought together with the other current choices (for greying out a button). */
export function isAvailable<T extends WithOptions>(
  variants: T[],
  axes: OptionAxis[],
  current: Selection,
  key: OptionKey,
  value: string,
  inStock: (v: T) => boolean,
): boolean {
  const match = findVariant(variants, axes, { ...current, [key]: value });
  return match ? inStock(match) : variants.some((v) => valueOf(v, key) === value && inStock(v));
}
