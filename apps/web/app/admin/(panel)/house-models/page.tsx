import Image from 'next/image';

import { listHouseModels } from '@repo/db/admin';

import { saveHouseModelAction, setHouseModelActiveAction } from '@/features/admin/actions/vendor-accounts';
import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Field, input, PageHead, Panel, secondaryButton } from '@/features/admin/ui';
import { mediaUrl } from '@/lib/site';

/**
 * House models (D-104): the founder's own models, 6 women and 4 men, each as a front pose and a back pose. The photo
 * worker dresses them in vendors' pieces; a piece goes on the first active model who wears what it is for, or the
 * one an admin picks on the piece's page.
 */
export default async function HouseModelsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const models = await listHouseModels(client);
  return (
    <div className="space-y-5">
      <PageHead title="House models" sub="Front pose and back pose of each model (D-104). Plain light background, fitted clothes, whole body." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {models.map((m) => (
          <Panel key={m.id} title={m.label} note={<Chip tone={m.is_active ? 'ok' : 'mute'}>{m.wears}{m.is_active ? '' : ' · off'}</Chip>}>
            <div className="grid grid-cols-2 gap-2">
              {[m.front_path, m.back_path].map((path) => (
                <div key={path} className="bg-surface relative aspect-[3/5] overflow-hidden rounded-md">
                  <Image src={mediaUrl(path)} alt={m.label} fill sizes="200px" className="object-contain" />
                </div>
              ))}
            </div>
            <form action={setHouseModelActiveAction.bind(null, m.id, !m.is_active)} className="mt-3">
              <button className={secondaryButton}>{m.is_active ? 'Switch off' : 'Switch on'}</button>
            </form>
          </Panel>
        ))}
      </div>
      <form action={saveHouseModelAction} className="max-w-2xl">
        <Panel title="Add a model">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Short name (e.g. w-1)"><input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={40} className={input} /></Field>
            <Field label="Label"><input name="label" required maxLength={60} className={input} /></Field>
            <Field label="Wears">
              <select name="wears" className={input}><option value="women">Women’s pieces</option><option value="men">Men’s pieces</option></select>
            </Field>
            <Field label="Front pose"><input name="front" type="file" accept="image/jpeg,image/png,image/webp" required className={input} /></Field>
            <Field label="Back pose"><input name="back" type="file" accept="image/jpeg,image/png,image/webp" required className={input} /></Field>
          </div>
          <button className={`${button} mt-4`}>Save model</button>
        </Panel>
      </form>
    </div>
  );
}
