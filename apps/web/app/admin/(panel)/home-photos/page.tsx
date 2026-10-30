import { listHomePhotos } from '@repo/db/admin';

import { requireAdminPage } from '@/features/admin/guard';
import { HomePhotosGrid } from '@/features/admin/home-photos/grid';
import { HomePhotosUpload } from '@/features/admin/home-photos/upload';
import { PageHead, panel } from '@/features/admin/ui';
import { ALBUM_MINIMUM } from '@/features/regions/region-album';

/**
 * Home photos (D-169, admin.md): the founder's own pictures for Home's drifting mosaic, the only ones it shows. Upload
 * many at once, put them in order on the mosaic as Home lays it out, change a line, remove one.
 */
export default async function HomePhotosPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const photos = await listHomePhotos(client);
  return (
    <div className="max-w-4xl space-y-5">
      <PageHead title="Home photos" />
      <p className="text-ink-muted">
        The photos that drift across Home under its first picture, in this order. Only these show there (the states&rsquo;
        albums stay on their own pages). Home shows the mosaic once there are {ALBUM_MINIMUM} or more; up to 60 are used.
        Landscape and portrait both work; 1,600 px wide or more looks sharp.
      </p>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">Add photos</h2>
        <p className="text-ink-muted text-sm">
          Pick as many as you like. Each needs a short line saying what it shows (read aloud to blind visitors); it starts
          from the file&rsquo;s name.
        </p>
        <HomePhotosUpload />
      </section>
      <section className={`${panel} space-y-3`}>
        <h2 className="font-heading text-[15px] font-semibold">The grid ({photos.length})</h2>
        {photos.length === 0 ? (
          <p className="text-ink-muted text-sm">No photos yet: Home shows no mosaic until you add some.</p>
        ) : (
          <>
            <p className="text-ink-muted text-sm">
              Drag a photo onto another tile to put it there, or tap one to move it a place at a time. Home drifts from the
              left, so photo 1 is the first one people see.
            </p>
            <HomePhotosGrid key={photos.map((p) => p.id).join()} photos={photos} />
          </>
        )}
      </section>
    </div>
  );
}
