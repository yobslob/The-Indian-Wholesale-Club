import { notFound } from 'next/navigation';

import { RECIPE_KINDS } from '@repo/db/store';

import { getRecipesCached, getStorePolicyCached } from '@/features/catalog/data';
import { deliveryDaysLabel } from '@/features/catalog/delivery-days';
import { KIND_LABEL, RecipeCard } from '@/features/recipes/recipe-card';
import { ShelfChips } from '@/features/recipes/shelf-chips';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cook at home',
  description: 'What you’d order out, made in your kitchen. The recipe is free; the masalas and dals come from India in one tap.',
  alternates: { canonical: '/recipes' },
};

/**
 * Cook at home, the shelf (D-203, plan §4.2): every live recipe as a card, the chips filtering by kind in the browser,
 * and how a kit works. One cached read (store_recipes), refreshed only when a recipe or a piece in a kit changes. No
 * live recipe yet: no shelf (ship dark).
 */
export default async function RecipesPage(): Promise<React.JSX.Element> {
  const [recipes, policy] = await Promise.all([getRecipesCached(), getStorePolicyCached()]);
  if (recipes.length === 0) notFound();
  const kinds = RECIPE_KINDS.filter((k) => recipes.some((r) => r.kind === k));
  const days = deliveryDaysLabel(policy.food_delivery_days_min, policy.food_delivery_days_max);

  return (
    <div className="space-y-[clamp(18px,2vw,28px)] py-[clamp(18px,2.4vw,40px)]">
      <header className="max-w-2xl">
        <p className="font-ui text-brand text-[13px] font-semibold uppercase tracking-[0.12em]">Cook at home</p>
        <h1 className="font-display mt-1 text-[clamp(30px,3vw,46px)] leading-[1.05]">What you&rsquo;d order out, made in your kitchen</h1>
        <p className="text-ink-muted mt-2">The recipe is free. The masalas and dals come from India, all in one tap. You bring the onions.</p>
      </header>
      {kinds.length > 1 ? <ShelfChips kinds={kinds} labels={KIND_LABEL} /> : null}
      <ul data-shelf className="grid grid-cols-2 gap-x-[var(--gap)] gap-y-6 md:grid-cols-3 lg:grid-cols-4">
        {recipes.map((r) => (
          <li key={r.slug}>
            <RecipeCard recipe={r} />
          </li>
        ))}
        <li className="bg-surface rounded-lg p-4 text-[14px]">
          <h2 className="font-heading text-[17px] font-medium">How a kit works</h2>
          <ol className="text-ink-muted mt-2 list-decimal space-y-1 pl-4">
            <li>Open a dish.</li>
            <li>Untick what you already have.</li>
            <li>Add the rest to your bag in one tap.</li>
          </ol>
          {days ? <p className="mt-2">Food arrives in {days}.</p> : null}
        </li>
      </ul>
    </div>
  );
}
