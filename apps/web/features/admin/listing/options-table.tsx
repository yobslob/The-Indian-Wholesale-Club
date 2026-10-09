'use client';

import { input } from '../styles';

export interface Option {
  key: string;
  colour: string;
  size: string;
  qty: string;
  weight: string;
}
export const newOption = (): Option => ({
  key: crypto.randomUUID(),
  colour: '',
  size: '',
  qty: '1',
  weight: '',
});

/** A new listing's options (D-096): colour and size (they drive the product page's pickers), pieces and weight. */
export function OptionsTable({
  options,
  setOptions,
  defaultWeight,
}: {
  options: Option[];
  setOptions: React.Dispatch<React.SetStateAction<Option[]>>;
  defaultWeight: number | null;
}): React.JSX.Element {
  const setOption = (key: string, k: keyof Option, value: string): void =>
    setOptions((list) => list.map((o) => (o.key === key ? { ...o, [k]: value } : o)));
  return (
    <fieldset>
      <legend className="font-ui text-ink-muted mb-1.5 block text-[12px] font-semibold leading-tight">
        Sizes / colours and pieces
      </legend>
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="text-ink-muted text-left text-[11px] font-semibold uppercase tracking-[0.06em]">
            <th className="px-1 pb-1.5 font-semibold">Colour</th>
            <th className="px-1 pb-1.5 font-semibold">Size</th>
            <th className="w-[72px] px-1 pb-1.5 text-right font-semibold">Pieces</th>
            <th className="w-[84px] px-1 pb-1.5 text-right font-semibold">Weight g</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {options.map((o, i) => (
            <tr key={o.key}>
              <td className="p-1">
                <input
                  aria-label={`Colour, option ${i + 1}`}
                  value={o.colour}
                  onChange={(e) => setOption(o.key, 'colour', e.target.value)}
                  placeholder="Off-white with gold"
                  className={`${input} md:h-[34px]`}
                />
              </td>
              <td className="p-1">
                <input
                  aria-label={`Size, option ${i + 1}`}
                  value={o.size}
                  onChange={(e) => setOption(o.key, 'size', e.target.value)}
                  placeholder="Free size"
                  className={`${input} md:h-[34px]`}
                />
              </td>
              <td className="p-1">
                <input
                  aria-label={`Pieces, option ${i + 1}`}
                  name="qty"
                  type="number"
                  min="0"
                  value={o.qty}
                  onChange={(e) => setOption(o.key, 'qty', e.target.value)}
                  className={`${input} text-right md:h-[34px]`}
                />
              </td>
              <td className="p-1">
                <input
                  aria-label={`Weight in grams, option ${i + 1}`}
                  type="number"
                  min="1"
                  value={o.weight}
                  onChange={(e) => setOption(o.key, 'weight', e.target.value)}
                  placeholder={defaultWeight ? String(defaultWeight) : ''}
                  className={`${input} text-right md:h-[34px]`}
                />
              </td>
              <td className="p-1 text-center">
                {options.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setOptions((l) => l.filter((x) => x.key !== o.key))}
                    className="text-ink-muted h-8 w-8"
                  >
                    ×
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => setOptions((l) => [...l, newOption()])}
        className="text-ink mt-1.5 min-h-11 px-1 text-[14px] font-semibold md:min-h-8"
      >
        + Add an option
      </button>
      <small className="text-ink-muted block text-[12px]">
        Leave colour and size empty for one size. An empty weight uses the category&apos;s usual
        one.
      </small>
    </fieldset>
  );
}
