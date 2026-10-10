import { notFound } from 'next/navigation';

import { getVendorSubmission, listHouseModels } from '@repo/db/admin';

import {
  approveVendorPieceAction,
  declineVendorPieceAction,
  rerunPhotoJobAction,
  retakeVendorPieceAction,
} from '@/features/admin/actions/vendor-pieces';
import { Chip } from '@/features/admin/chips';
import { requireAdminPage } from '@/features/admin/guard';
import { signedUrls } from '@/features/admin/signed';
import { button, dangerButton, Field, input, PageHead, Panel, rupees, secondaryButton } from '@/features/admin/ui';

const REASONS = [
  ['blurry', 'Blurry'],
  ['dark', 'Too dark'],
  ['background', 'Busy background'],
  ['not_whole', 'Whole piece not in the photo'],
  ['wrong_piece', 'Wrong piece'],
  ['other', 'Other (say why)'],
] as const;

/**
 * One vendor piece (D-103): the shop's real photos and words, the AI candidates per pose (D-104), and the decision:
 * publish with the picked photos (the real close-up always goes with them, D-100), ask for new photos, or decline.
 */
export default async function VendorPiecePage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const { client } = await requireAdminPage();
  const [piece, models] = await Promise.all([getVendorSubmission(client, id), listHouseModels(client)]);
  if (!piece) notFound();
  const jobs = [...(piece.jobs ?? [])].sort((a, b) => a.view.localeCompare(b.view)).reverse();   // front, then back
  const [raw, cand] = await Promise.all([
    signedUrls(client, 'vendor-uploads', (piece.photos ?? []).map((p) => p.storage_path)),
    signedUrls(client, 'photo-candidates', jobs.flatMap((j) => j.candidates ?? [])),
  ]);
  const details = piece.details as Record<string, string>;
  const open = piece.status === 'waiting' || piece.status === 'photos_ready';
  const job = (view: 'front' | 'back') => jobs.find((j) => j.view === view);

  return (
    <div className="space-y-5">
      <PageHead
        back={{ href: '/admin/vendor-pieces', label: 'Vendor pieces' }}
        title={piece.category?.name ?? 'Piece'}
        sub={<>{piece.vendor?.shop_name} · {piece.vendor?.region?.name} · {details.wears ?? '—'} · shop price {rupees(piece.shop_price_paise)}</>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Panel title="From the shop" note="real photos">
          <div className="grid grid-cols-3 gap-2">
            {(['front', 'back', 'closeup'] as const).map((view) => {
              const src = raw.get(piece.photos?.find((p) => p.view === view)?.storage_path ?? '');
              return (
                <figure key={view}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- private signed photo */}
                  {src ? <img src={src} alt={view} className="border-line aspect-[3/4] w-full rounded-md border object-cover" /> : <span className="bg-surface block aspect-[3/4] rounded-md" />}
                  <figcaption className="text-ink-muted mt-1 text-[12px]">{view}</figcaption>
                </figure>
              );
            })}
          </div>
          <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[13px]">
            {(['fabric', 'care', 'colour', 'note'] as const).map((k) => (
              <div key={k} className="contents"><dt className="text-ink-muted">{k}</dt><dd>{details[k] ?? '—'}</dd></div>
            ))}
            <dt className="text-ink-muted">sizes</dt>
            <dd>{(piece.variants as { label: string; qty: number }[]).map((v) => `${v.label} × ${v.qty}`).join(', ')}</dd>
          </dl>
        </Panel>

        <form action={approveVendorPieceAction.bind(null, piece.id)} className="space-y-4">
          {(['front', 'back'] as const).map((view) => {
            const j = job(view);
            return (
              <Panel key={view} title={`${view === 'front' ? 'Front' : 'Back'} pose`} note={j ? <Chip tone={j.status === 'done' ? 'ok' : j.status === 'failed' ? 'bad' : 'warn'}>{j.status}</Chip> : 'no AI photo'}>
                {j?.error ? <p className="text-danger mb-2 text-[13px]">{j.error}</p> : null}
                <div className="grid grid-cols-3 gap-2">
                  {(j?.candidates ?? []).map((path, i) => (
                    <label key={path} className="has-[:checked]:ring-brand cursor-pointer rounded-md ring-2 ring-transparent">
                      <input type="radio" name={view} value={path} defaultChecked={i === 0} required={view === 'front'} className="sr-only" />
                      {/* eslint-disable-next-line @next/next/no-img-element -- private signed candidate */}
                      <img src={cand.get(path) ?? ''} alt={`${view} candidate ${i + 1}`} className="aspect-[3/4] w-full rounded-md object-cover" />
                    </label>
                  ))}
                </div>
              </Panel>
            );
          })}
          <Panel title="In the store">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name (customers see it)"><input name="name" required minLength={2} maxLength={120} className={input} /></Field>
              <Field label="Price in $ (empty = from the shop price, D-075)"><input name="price" inputMode="decimal" pattern="\d+(\.\d{1,2})?" className={input} /></Field>
              <Field label="Fabric (English)"><input name="fibre" required defaultValue={details.fabric ?? ''} className={input} /></Field>
              <Field label="Care (English)"><input name="care" required defaultValue={details.care ?? ''} className={input} /></Field>
              <Field label="Summary"><input name="summary" maxLength={300} className={input} /></Field>
              <Field label="Then">
                <select name="publish" className={input} defaultValue="live"><option value="live">Publish now</option><option value="draft">Save as a draft</option></select>
              </Field>
            </div>
            <button disabled={!open || !job('front')?.candidates?.length} className={`${button} mt-4`}>Approve</button>
          </Panel>
        </form>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Make again">
          {jobs.map((j) => (
            <form key={j.id} action={rerunPhotoJobAction.bind(null, piece.id, j.id)} className="mb-2 flex gap-2">
              <select name="house_model" className={input} defaultValue={j.house_model_id ?? ''}>
                <option value="">{j.view}: same model</option>
                {models.filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{j.view}: {m.label}</option>)}
              </select>
              <button disabled={!open || j.status === 'queued' || j.status === 'running'} className={secondaryButton}>Again</button>
            </form>
          ))}
        </Panel>
        <Panel title="Ask for new photos">
          <form action={retakeVendorPieceAction.bind(null, piece.id)} className="space-y-2">
            <select name="reason" className={input}>{REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input name="note" placeholder="Note (only admins see it)" className={input} />
            <button disabled={!open} className={secondaryButton}>Ask the shop</button>
          </form>
        </Panel>
        <Panel title="Decline">
          <form action={declineVendorPieceAction.bind(null, piece.id)} className="space-y-2">
            <input name="note" placeholder="Why (only admins see it)" className={input} />
            <button disabled={piece.status === 'approved' || piece.status === 'declined'} className={dangerButton}>Decline</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
