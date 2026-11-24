import Link from 'next/link';

import { lineHealth, listRecipes } from '@repo/db/admin';
import { formatUsd } from '@repo/shared/domain';

import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { RecipeDraftsUpload } from '@/features/admin/recipes/drafts-upload';
import { RecipePhotosByName } from '@/features/admin/recipes/photos-by-name';
import { RecipesPublishAll } from '@/features/admin/recipes/publish-all';
import { button, PageHead, panel } from '@/features/admin/ui';

const STATUS: Record<string, [string, 'ok' | 'mute' | 'warn']> = {
  live: ['Live', 'ok'],
  draft: ['Draft', 'mute'],
  archived: ['Archived', 'warn'],
};

/**
 * Admin → Recipes (D-203, admin.md): every recipe on one page with its status, whether its words are approved, its kit's
 * health and whether it leads Home's row. Publish all (D-204), add photos by name and add drafts from a file above the
 * list.
 */
export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<{ health?: string }>;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { health } = await searchParams;
  const all = await listRecipes(client);
  const rows = all.map((r) => {
    const iwc = r.recipe_ingredients.filter((l) => l.source === 'iwc' && !l.instead_of);
    const states = iwc.map(lineHealth);
    const ok = states.filter((s) => s === 'ok').length;
    const kit = iwc.reduce(
      (sum, l, i) =>
        states[i] === 'ok'
          ? sum +
            (l.product_variants?.price_cents ?? l.product_variants?.products?.price_cents ?? 0)
          : sum,
      0,
    );
    return { r, iwc: iwc.length, ok, missing: iwc.length - ok, kit };
  });
  const shown =
    health === 'missing' ? rows.filter((x) => x.r.status === 'live' && x.missing > 0) : rows;
  const live = rows.filter((x) => x.r.status === 'live').length;
  const drafts = rows.filter((x) => x.r.status === 'draft').length;

  return (
    <div className="max-w-5xl space-y-5">
      <PageHead
        title="Recipes"
        sub={`${rows.length} recipes · ${live} live. Home's Cook at home row starts with the one marked On Home.`}
        actions={
          <Link href="/admin/recipes/new" className={button}>
            New recipe
          </Link>
        }
      />
      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">Publish all</h2>
        <p className="text-ink-muted text-sm">
          Every draft goes live with its words approved. An ingredient with no listing yet takes the
          cheapest live one whose name holds its match words; change any of them in the recipe
          afterwards. Recipes without a photo show the kadai drawing until you add one. A recipe
          goes live only when at least one of its pieces can be bought.
        </p>
        <RecipesPublishAll drafts={drafts} />
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">Add photos by name</h2>
        <p className="text-ink-muted text-sm">
          Name each photo by its recipe&rsquo;s address, such as <code>pav-bhaji.jpg</code> (letter
          case, spaces and underscores don&rsquo;t matter). Pick many at once; each replaces that
          recipe&rsquo;s earlier photo.
        </p>
        <RecipePhotosByName />
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">Add drafts from a file</h2>
        <p className="text-ink-muted text-sm">
          A JSON file of drafted recipes (<code>catalogue/recipes-drafts-1.json</code> and on). Each
          comes in as a draft with draft words; a recipe still a draft is replaced by the
          file&rsquo;s version, a live or approved one is left as it is. Then Publish all.
        </p>
        <RecipeDraftsUpload />
      </section>
      <section className={`${panel} overflow-x-auto`}>
        {health === 'missing' ? (
          <p className="mb-2 text-sm">
            Live recipes with a missing piece ·{' '}
            <Link href="/admin/recipes" className="underline">
              show all
            </Link>
          </p>
        ) : null}
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="text-ink-muted text-[12px]">
            <tr>
              <th className="py-2 pr-3 font-semibold">Recipe</th>
              <th className="pr-3 font-semibold">Status</th>
              <th className="pr-3 font-semibold">Words</th>
              <th className="pr-3 font-semibold">Kit</th>
              <th className="pr-3 font-semibold">Photo</th>
              <th className="font-semibold">Home</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ r, iwc, ok, missing, kit }) => {
              const [label, tone] = STATUS[r.status] ?? [r.status, 'mute'];
              return (
                <tr key={r.id} className="border-line border-t">
                  <td className="py-2 pr-3">
                    <Link
                      href={`/admin/recipes/${r.id}`}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {r.name}
                    </Link>
                    <div className="text-ink-muted text-[12px]">
                      {r.regions?.name ?? 'All of India'} · {r.kind}
                    </div>
                  </td>
                  <td className="pr-3">
                    <Chip tone={tone}>{label}</Chip>
                  </td>
                  <td className="pr-3">
                    <Chip tone={r.content_status === 'approved' ? 'ok' : 'warn'}>
                      {r.content_status === 'approved' ? 'Approved' : 'Draft'}
                    </Chip>
                  </td>
                  <td className="pr-3">
                    {ok} of {iwc} on IWC
                    {missing > 0 ? (
                      <span className="text-caution"> · {missing} missing</span>
                    ) : null}
                    {kit > 0 ? (
                      <div className="text-ink-muted text-[12px]">{formatUsd(kit)}</div>
                    ) : null}
                  </td>
                  <td className="pr-3">
                    {r.photo_path ? 'Yes' : <span className="text-caution">None</span>}
                  </td>
                  <td>{r.home_rank !== null ? <Chip tone="brand">On Home</Chip> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="text-ink-muted py-3 text-sm">No recipes yet.</p> : null}
      </section>
    </div>
  );
}
