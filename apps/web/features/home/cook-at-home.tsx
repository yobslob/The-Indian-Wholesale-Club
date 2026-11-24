import Link from 'next/link';

import { sectionHeading } from '@/features/catalog/product-row';
import { RecipeCard } from '@/features/recipes/recipe-card';

import type { RecipeCard as Recipe } from '@repo/db/store';

/**
 * Cook at home on Home (D-204, founder 2026-11-23: "let's remove the windows and put something else, just for recipes on
 * home page"): right under the hero, a row of recipe cards (the pinned one first, then the shelf's order; 12 from
 * store_home), each with its kit price, and the way to every recipe. Server-drawn like the shelf; a phone slides the
 * row, a wide screen shows six. Hidden while no recipe is live.
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
