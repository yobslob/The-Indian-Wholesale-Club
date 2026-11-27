'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { creditsFromCsv, slugFromFileName, type PhotoCredit } from '@repo/shared/domain';

import { recipePhotoByNameAction } from '../actions/recipes';
import { secondaryButton } from '../styles';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * D-203 answer 4: the founder's dish photos, many at once, each to the recipe its file name names (or, with `recipeId`,
 * one photo to this recipe). One file a call (D-146), so a failure stops only that file; the list says what matched.
 * D-214: the recipe photo runner's credits.csv chosen with them gives each openly licensed photo its credit line.
 */
export function RecipePhotosByName({ recipeId }: { recipeId?: string }): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<{ name: string; result: string; ok: boolean }[]>([]);

  async function send(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    const out: { name: string; result: string; ok: boolean }[] = [];
    const all = Array.from(files);
    const csv = recipeId ? undefined : all.find((f) => /\.csv$/i.test(f.name));
    const credits: Map<string, PhotoCredit> = csv ? creditsFromCsv(await csv.text()) : new Map();
    const photos = all.filter((f) => f !== csv);
    const list = recipeId ? photos.slice(0, 1) : photos;
    for (const [i, file] of list.entries()) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      if (!TYPES.includes(file.type)) {
        out.push({ name: file.name, result: 'not a JPEG, PNG, WebP or AVIF image', ok: false });
        continue;
      }
      const form = new FormData();
      form.set('image', file);
      if (recipeId) form.set('recipe_id', recipeId);
      const credit = credits.get(slugFromFileName(file.name));
      if (credit) form.set('credit', JSON.stringify(credit));
      const { error, slug } = await recipePhotoByNameAction(form);
      out.push({
        name: file.name,
        result:
          error ?? `→ ${slug}${credit ? ` (credit: ${credit.author}, ${credit.licence})` : ''}`,
        ok: !error,
      });
      setReport([...out]);
    }
    setBusy(null);
    setReport(out);
    if (out.some((r) => r.ok)) router.refresh();
  }

  return (
    <div className="space-y-2">
      <label className={`${secondaryButton} cursor-pointer`}>
        {busy ?? (recipeId ? 'Choose a photo…' : 'Choose photos (and credits.csv)…')}
        <input
          type="file"
          multiple={!recipeId}
          accept={recipeId ? TYPES.join(',') : [...TYPES, '.csv', 'text/csv'].join(',')}
          className="sr-only"
          disabled={busy !== null}
          onChange={(e) => {
            void send(e.target.files);
            e.target.value = '';
          }}
        />
      </label>
      {report.length > 0 ? (
        <ul className="text-sm">
          {report.map((r) => (
            <li key={r.name} className={r.ok ? '' : 'text-danger'}>
              {r.name} {r.result}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
