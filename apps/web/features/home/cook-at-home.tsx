import Link from 'next/link';

import { RECIPE_KINDS } from '@repo/db/store';

import { sectionHeading } from '@/features/catalog/product-row';
import { KIND_LABEL, RecipeCard } from '@/features/recipes/recipe-card';

import type { RecipeCard as Recipe } from '@repo/db/store';

/**
 * Cook at home on Home (D-204, founder 2026-11-23: "let's remove the windows and put something else, just for recipes on
 * home page"): right under the hero, a row of recipe cards (the pinned one first, then the shelf's order; 12 from
 * store_home), each with its kit price, and the way to every recipe. Server-drawn like the shelf; a phone slides the
 * row, a wide screen shows six. Hidden while no recipe is live.
 * D-213 (founder 2026-11-27: "on the home page make the categories for recipe"): the kinds as links above the cards,
 * each opening the shelf on that kind (`/recipes?kind=snacks`, which the shelf's chips read).
 */
export function CookAtHome({ recipes }: { recipes: Recipe[] }): React.JSX.Element | null {
  if (recipes.length === 0) return null;
  return (
    <section id="cook" aria-labelledby="cook-h" className="scroll-mt-20 py-[clamp(24px,3vw,48px)]">
      <div className="mb-[clamp(16px,1.8vw,24px)] flex items-end justify-between gap-4">
        <div>
          <h2 id="cook-h" className={sectionHeading}>
            Cook at home
          </h2>
          <p className="text-ink-muted mt-1.5 text-sm">
            The recipe&rsquo;s on us. Its spices come in one tap.
          </p>
        </div>
        <Link
          href="/recipes"
          className="font-ui flex-none text-[14px] font-medium underline underline-offset-4"
        >
          All recipes
        </Link>
      </div>
      <nav aria-label="Recipes by kind" className="mb-[clamp(14px,1.6vw,20px)]">
        <ul className="no-scrollbar -mx-[var(--gut)] flex gap-2 overflow-x-auto px-[var(--gut)] md:mx-0 md:flex-wrap md:px-0">
          {RECIPE_KINDS.map((k) => (
            <li key={k} className="flex-none">
              <Link
                href={`/recipes?kind=${k}`}
                prefetch={false}
                className="font-ui rounded-pill border-line bg-paper text-ink hover:border-ink inline-flex h-10 items-center whitespace-nowrap border px-4 text-[14px] font-medium transition-colors"
              >
                {KIND_LABEL[k]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <ul className="-mx-[var(--gut)] flex snap-x gap-[var(--gap)] overflow-x-auto px-[var(--gut)] pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
        {recipes.map((r, i) => (
          <li
            key={r.slug}
            className={`w-[160px] flex-none snap-start md:w-auto ${i >= 6 ? 'md:hidden' : ''}`}
          >
            <RecipeCard recipe={r} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  );
}
