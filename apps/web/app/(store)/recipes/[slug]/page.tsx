import Link from 'next/link';
import { notFound } from 'next/navigation';

import { recipeTime } from '@repo/shared/domain';

import { getRecipeCached, getRecipesCached, getStorePolicyCached } from '@/features/catalog/data';
import { deliveryDaysLabel } from '@/features/catalog/delivery-days';
import { StorePhoto } from '@/features/catalog/store-photo';
import { CookMode } from '@/features/recipes/cook-mode';
import { KadaiArt } from '@/features/recipes/kadai-art';
import { KitCard } from '@/features/recipes/kit-card';
import { PhotoCreditLine } from '@/features/recipes/photo-credit';
import { KIND_LABEL, RecipeCard } from '@/features/recipes/recipe-card';
import { recipeJsonLdText, recipeMetadata } from '@/features/recipes/recipe-seo';
import { siteUrl } from '@/lib/env';
import { mediaUrl } from '@/lib/site';

import type { RecipeIwcLine } from '@repo/db/store';
import type { Metadata } from 'next';

type Params = Promise<{ slug: string }>;

const EFFORT: Record<string, string> = { easy: 'Easy', medium: 'Medium', weekend: 'Weekend' };

/** The live recipes are built with the site; a new one on its first visit (PR-1). Unknown slugs 404. */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    return (await getRecipesCached()).map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const recipe = await getRecipeCached((await params).slug);
  return recipe ? recipeMetadata(recipe) : {};
}

/**
 * A recipe (D-203, plan §4.3): the dish photo, its state and kind, the name and three facts; the kit from IWC (the one
 * client part with Cook mode); what to buy locally; the method; More to cook. One cached store_recipe() read plus the
 * shelf's cached read for More to cook.
 */
export default async function RecipePage({ params }: { params: Params }): Promise<React.JSX.Element> {
  const { slug } = await params;
  const [recipe, all, policy] = await Promise.all([getRecipeCached(slug), getRecipesCached(), getStorePolicyCached()]);
  if (!recipe) notFound();
  const iwc = recipe.lines.filter((l): l is RecipeIwcLine => l.source === 'iwc');
  const local = recipe.lines.filter((l) => l.source === 'local');
  const more = all
    .filter((r) => r.slug !== recipe.slug)
    .sort((a, b) => Number(b.kind === recipe.kind) - Number(a.kind === recipe.kind) || Number(b.region_slug === recipe.region_slug) - Number(a.region_slug === recipe.region_slug))
    .slice(0, 8);

  return (
    <article className="mx-auto max-w-3xl space-y-[clamp(18px,2.4vw,32px)] pb-28 md:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: recipeJsonLdText(recipe, siteUrl()) }} />
      <figure>
        <div className="bg-land relative -mx-[var(--gut)] h-[300px] overflow-hidden md:mx-0 md:h-[420px] md:rounded-lg">
          <KadaiArt className="text-ink-muted/40 absolute inset-0 m-auto h-1/3 w-1/3" />
          {recipe.photo_path ? <StorePhoto src={mediaUrl(recipe.photo_path)} alt={recipe.name} sizes="(min-width: 768px) 768px, 100vw" priority className="object-cover" /> : null}
        </div>
        {recipe.photo_path && recipe.photo_credit ? <PhotoCreditLine credit={recipe.photo_credit} /> : null}
      </figure>

      <header>
        <p className="font-ui flex flex-wrap gap-2 text-[13px] font-medium">
          {recipe.region_slug ? (
            <Link href={`/states/${recipe.region_slug}`} className="bg-surface rounded-pill px-3 py-1 underline-offset-2 hover:underline">
              {recipe.region_name}
            </Link>
          ) : (
            <span className="bg-surface rounded-pill px-3 py-1">All of India</span>
          )}
          <Link href={`/recipes?kind=${recipe.kind}`} className="bg-surface rounded-pill px-3 py-1 underline-offset-2 hover:underline">
            {KIND_LABEL[recipe.kind]}
          </Link>
        </p>
        <h1 className="font-display mt-3 text-[30px] leading-[1.05] md:text-[40px]">{recipe.name}</h1>
        {recipe.blurb ? <p className="text-ink-muted mt-2">{recipe.blurb}</p> : null}
        <dl className="font-ui mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ['Time', recipeTime(recipe.minutes, recipe.soak_hours)],
            ['Serves', String(recipe.serves)],
            ['Effort', EFFORT[recipe.effort] ?? recipe.effort],
          ].map(([k, v]) => (
            <div key={k} className="border-line rounded-lg border px-2 py-2.5">
              <dt className="text-ink-muted text-[12px]">{k}</dt>
              <dd className="text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <KitCard
        name={recipe.name}
        lines={iwc}
        days={deliveryDaysLabel(policy.food_delivery_days_min, policy.food_delivery_days_max)}
        freeMinCents={policy.free_shipping_min_cents}
      />

      {local.length > 0 ? (
        <section aria-labelledby="local-title" className="border-line rounded-lg border border-dashed p-[clamp(18px,2.4vw,28px)]">
          <h2 id="local-title" className="font-heading text-[20px] font-medium">
            From your local store
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[15px]">
            {local.map((l, i) => (
              <li key={`${l.label}-${i}`}>
                {l.label}
                {l.amount ? <span className="text-ink-muted"> · {l.amount}</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-ink-muted mt-3 text-[13px]">Fresh things, butter and oil are left to the store down the road.</p>
        </section>
      ) : null}

      <section aria-labelledby="method-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="method-title" className="font-heading text-[22px] font-medium">
            Method
          </h2>
          <CookMode />
        </div>
        <ol className="mt-3 space-y-3">
          {recipe.steps.map((s, i) => (
            <li key={i} className="bg-surface grid grid-cols-[32px_1fr] gap-3 rounded-lg p-4">
              <span className="font-display text-brand text-[22px] leading-none">{i + 1}</span>
              <div>
                <p>{s.text}</p>
                {s.minutes ? <span className="bg-paper font-ui mt-2 inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold">{s.minutes} min</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {more.length > 0 ? (
        <section aria-labelledby="more-title">
          <h2 id="more-title" className="font-heading text-[22px] font-medium">
            More to cook
          </h2>
          <ul className="-mx-[var(--gut)] mt-3 flex snap-x gap-[var(--gap)] overflow-x-auto px-[var(--gut)] pb-2">
            {more.map((r) => (
              <li key={r.slug} className="w-[160px] flex-none snap-start">
                <RecipeCard recipe={r} size="sm" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
