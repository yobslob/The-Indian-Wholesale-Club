import { notFound } from 'next/navigation';

import { listRegionsAdmin } from '@repo/db/admin';

import { approveRegionAction, updateRegionAction } from '@/features/admin/actions/catalog';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Field, input, PageTitle } from '@/features/admin/ui';

type Params = Promise<{ id: string }>;

/** Edit a region's customer-facing content. Saving marks it draft again until approved (D-019). */
export default async function RegionEditPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  const region = (await listRegionsAdmin(client)).find((r) => r.id === id);
  if (!region) notFound();

  return (
    <div className="space-y-6">
      <PageTitle>{region.name}</PageTitle>
      <p>
        Content: <strong>{region.content_status}</strong>
        {region.greeting_script ? ` · script ${region.greeting_script}` : ''}
      </p>
      <form action={updateRegionAction.bind(null, region.id)} className="grid max-w-2xl gap-3">
        <Field label="Greeting (native script)">
          <input
            name="greetingNative"
            defaultValue={region.greeting_native ?? ''}
            className={input}
          />
        </Field>
        <Field label="Greeting (Latin letters)">
          <input
            name="greetingLatin"
            defaultValue={region.greeting_latin ?? ''}
            className={input}
          />
        </Field>
        <Field label="Meaning">
          <input
            name="greetingMeaning"
            defaultValue={region.greeting_meaning ?? ''}
            className={input}
          />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={region.tagline ?? ''} className={input} />
        </Field>
        <Field label="Story">
          <textarea name="story" rows={6} defaultValue={region.story ?? ''} className={input} />
        </Field>
        <Field label="Accent colour (#RRGGBB)">
          <input name="accentColor" defaultValue={region.accent_color ?? ''} className={input} />
        </Field>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isLive" defaultChecked={region.is_live} /> Live (products can
          be browsed)
        </label>
        <button type="submit" className={button}>
          Save (needs approval again)
        </button>
      </form>
      {region.content_status === 'draft' ? (
        <form action={approveRegionAction.bind(null, region.id)}>
          <button type="submit" className={button}>
            Approve for customers
          </button>
        </form>
      ) : null}
    </div>
  );
}
