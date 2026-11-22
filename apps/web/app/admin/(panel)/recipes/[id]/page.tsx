import { notFound } from 'next/navigation';

import { getRecipeAdmin, lineHealth, listRegionChoices, recipeBlockers } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { RecipeEditor, type EditorLine } from '@/features/admin/recipes/editor';
import { RecipeStatusBar } from '@/features/admin/recipes/status-bar';
import { PageHead } from '@/features/admin/ui';
import { mediaUrl } from '@/lib/site';

/**
 * A recipe's editor (D-203, admin.md): the kit-health strip and its buttons on top (approve the words, publish, On
 * Home's window), then the photo, the words, the ingredients with their listings, and the steps. `new` makes one.
 */
export default async function RecipeEditPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  const regions = await listRegionChoices(client);
  if (id === 'new') {
    return (
      <div className="max-w-4xl">
        <PageHead title="New recipe" back={{ href: '/admin/recipes', label: 'Recipes' }} />
        <RecipeEditor recipeId={null} regions={regions} initial={null} />
      </div>
    );
  }
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [r, blockers] = await Promise.all([getRecipeAdmin(client, id), recipeBlockers(client, id)]);
  if (!r) notFound();
  const lines: EditorLine[] = r.recipe_ingredients.map((l) => ({
    key: l.id,
    id: l.id,
    label: l.label,
    amount: l.amount,
    source: l.source === 'iwc' ? 'iwc' : 'local',
    variant_id: l.variant_id,
    match_words: l.match_words,
    listing: l.product_variants
      ? {
          name: l.product_variants.products?.name ?? '',
          label: l.product_variants.label,
          price_cents: l.product_variants.price_cents ?? l.product_variants.products?.price_cents ?? 0,
          health: lineHealth(l),
        }
      : null,
  }));
  return (
    <div className="max-w-4xl space-y-5">
      <PageHead title={r.name} back={{ href: '/admin/recipes', label: 'Recipes' }} sub={`/recipes/${r.slug}`} />
      <RecipeStatusBar
        recipeId={r.id}
        status={r.status as 'draft' | 'live' | 'archived'}
        approved={r.content_status === 'approved'}
        onHome={r.home_rank !== null}
        blockers={blockers}
      />
      <RecipeEditor
        recipeId={r.id}
        regions={regions}
        photo={r.photo_path ? { url: mediaUrl(r.photo_path), path: r.photo_path } : null}
        initial={{
          slug: r.slug,
          name: r.name,
          region_id: r.region_id,
          kind: r.kind as 'snacks',
          blurb: r.blurb,
          minutes: r.minutes,
          soak_hours: r.soak_hours,
          serves: r.serves,
          effort: r.effort as 'easy',
          steps: Array.isArray(r.steps) ? (r.steps as { text: string; minutes: number | null }[]) : [],
          sort: r.sort,
          lines,
        }}
      />
    </div>
  );
}
