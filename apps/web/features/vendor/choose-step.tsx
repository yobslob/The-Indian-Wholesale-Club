'use client';

import { t, WEARS, type Language, type Wears } from '@repo/shared/vendor';

import { Icon, type IconName } from './icons';

export type Category = { id: string; name: string; product_type: 'clothing' | 'spice' };

const WEARS_ICON: Record<Wears, IconName> = { women: 'women', men: 'men', kids: 'kids', unisex: 'anyone' };

/** Step one: what the piece is (big tiles, clothing first), then who wears it (four pictures; clothing only). */
export function ChooseStep({
  lang,
  categories,
  category,
  wears,
  onCategory,
  onWears,
}: {
  lang: Language;
  categories: Category[];
  category: Category | null;
  wears: Wears | null;
  onCategory: (c: Category) => void;
  onWears: (w: Wears) => void;
}): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-heading mb-3 text-[22px] font-semibold">{t(lang, 'what_is_it')}</h2>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category?.id === c.id}
              onClick={() => onCategory(c)}
              className={`min-h-14 rounded-[14px] border px-3 py-2 text-left text-[15px] font-semibold leading-tight ${category?.id === c.id ? 'border-brand bg-brand text-on-brand' : 'border-line bg-paper text-ink'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
      {category?.product_type === 'clothing' ? (
        <div>
          <h2 className="font-heading mb-3 text-[22px] font-semibold">{t(lang, 'who_wears')}</h2>
          <div className="grid grid-cols-4 gap-2">
            {WEARS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={wears === w}
                onClick={() => onWears(w)}
                className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-[14px] border text-[13px] font-semibold ${wears === w ? 'border-brand bg-brand text-on-brand' : 'border-line bg-paper text-ink'}`}
              >
                <Icon name={WEARS_ICON[w]} className="h-8 w-8" />
                {t(lang, `wears_${w}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
