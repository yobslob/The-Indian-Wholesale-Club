import Image from 'next/image';
import { notFound } from 'next/navigation';

import { getRegionAdmin, listRegionPhotos } from '@repo/db/admin';

import {
  approveRegionAction,
  removeAlbumPhotoAction,
  updateRegionAction,
  uploadAlbumPhotoAction,
  uploadRegionImageAction,
} from '@/features/admin/actions/regions';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Field, input, linkButton, PageTitle } from '@/features/admin/ui';
import { mediaUrl } from '@/lib/site';

type Params = Promise<{ id: string }>;

const SCRIPT_LABELS: Record<string, string> = {
  Deva: 'Devanagari (Hindi, Marathi, Rajasthani…)',
  Beng: 'Bengali–Assamese',
  Guru: 'Gurmukhi (Punjabi)',
  Gujr: 'Gujarati',
  Orya: 'Odia',
  Taml: 'Tamil',
  Telu: 'Telugu',
  Knda: 'Kannada',
  Mlym: 'Malayalam',
  Latn: 'Latin letters only',
};

/** Edit a region's customer-facing content. Saving text marks it draft again until approved (D-019). */
export default async function RegionEditPage({
  params,
}: {
  params: Params;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const { id } = await params;
  const region = await getRegionAdmin(client, id);
  if (!region) notFound();
  const album = await listRegionPhotos(client, region.id);

  return (
    <div className="space-y-6">
      <PageTitle>{region.name}</PageTitle>
      <p>
        Content: <strong>{region.content_status}</strong>
        {region.greeting_script ? ` · script ${region.greeting_script}` : ''}
      </p>

      <section className="border-line max-w-2xl space-y-3 rounded-md border p-3">
        <h2 className="font-medium">Main photo</h2>
        <p className="text-ink-muted text-sm">
          Shown on the region page and on its stamp on the home page. JPEG, PNG, WebP or AVIF, up to 8 MB; portrait works best.
        </p>
        {region.hero_image_path ? (
          <div className="bg-surface relative aspect-[4/5] w-40 overflow-hidden rounded-md">
            <Image src={mediaUrl(region.hero_image_path)} alt={`${region.name}: current photo`} fill sizes="160px" className="object-cover" />
          </div>
        ) : (
          <p className="text-sm">No photo yet.</p>
        )}
        <form action={uploadRegionImageAction.bind(null, region.id)} className="flex flex-wrap items-center gap-3">
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required aria-label="Photo file" />
          <button type="submit" className={button}>
            {region.hero_image_path ? 'Replace photo' : 'Upload photo'}
          </button>
        </form>
      </section>

      <section className="border-line max-w-2xl space-y-3 rounded-md border p-3">
        <h2 className="font-medium">Album ({album.length})</h2>
        <p className="text-ink-muted text-sm">
          More photos of {region.name}: the region page shows them as a slow sideways mosaic once there are three or more.
          Landscape and portrait both work; 1,600 px wide or more looks sharp. Each photo needs a line describing it.
        </p>
        {album.length > 0 ? (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {album.map((photo) => (
              <li key={photo.id} className="space-y-1.5">
                <div className="bg-surface relative aspect-square overflow-hidden rounded-md">
                  <Image src={mediaUrl(photo.storage_path)} alt={photo.alt_text} fill sizes="160px" className="object-cover" />
                </div>
                <p className="text-ink-muted line-clamp-2 text-xs">{photo.alt_text}</p>
                <form action={removeAlbumPhotoAction.bind(null, region.id, photo.id)}>
                  <button type="submit" className={`${linkButton} text-sm`}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
        <form action={uploadAlbumPhotoAction.bind(null, region.id)} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" required aria-label="Album photo file" />
          <span />
          <Field label="What the photo shows (alt text)">
            <input name="alt" required maxLength={300} className={input} placeholder="Women dancing Giddha at a village fair" />
          </Field>
          <button type="submit" className={`${button} self-end`}>
            Add to album
          </button>
        </form>
      </section>

      <form action={updateRegionAction.bind(null, region.id)} className="grid max-w-2xl gap-3">
        <Field label="Greeting (native script)">
          <input name="greetingNative" defaultValue={region.greeting_native ?? ''} className={input} />
        </Field>
        <Field label="Script of the greeting (sets its font on the region page)">
          <select name="greetingScript" defaultValue={region.greeting_script ?? ''} className={input}>
            <option value="">None</option>
            {Object.entries(SCRIPT_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Greeting (Latin letters)">
          <input name="greetingLatin" defaultValue={region.greeting_latin ?? ''} className={input} />
        </Field>
        <Field label="Meaning">
          <input name="greetingMeaning" defaultValue={region.greeting_meaning ?? ''} className={input} />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={region.tagline ?? ''} className={input} />
        </Field>
        <Field label="Story">
          <textarea name="story" rows={6} defaultValue={region.story ?? ''} className={input} />
        </Field>
        <Field label="Accent colour (#RRGGBB, dark enough for text: at least 4.5 : 1 on the page backgrounds)">
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
