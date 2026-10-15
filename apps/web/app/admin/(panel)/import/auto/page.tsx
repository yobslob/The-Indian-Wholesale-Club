import Link from 'next/link';

import {
  countTargets,
  getSourcingSettings,
  listHeldSources,
  listSourcedDrafts,
  listSourcingRuns,
  listSourcingShops,
  listTargets,
} from '@repo/db/admin';
import { attributesSchemaFor, PRODUCT_TYPE_LABEL } from '@repo/shared/domain';

import { requireAdminPage } from '@/features/admin/guard';
import {
  deleteTargetAction,
  publishReadyAction,
  searchNothingFitAgainAction,
  setTargetAction,
} from '@/features/admin/import/auto/actions';
import {
  HeldPrices,
  RunsTable,
  SettingsForm,
  ShopsTable,
} from '@/features/admin/import/auto/sections';
import { TargetsUpload } from '@/features/admin/import/auto/targets-upload';
import { button, Cell, FilterChips, PageHead, Panel, Sub, Table, When } from '@/features/admin/ui';

const STATUSES = ['queued', 'searching', 'found', 'none', 'paused'] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABEL: Record<Status, string> = {
  queued: 'Waiting',
  searching: 'Being searched',
  found: 'Found',
  none: 'Nothing fit',
  paused: 'Paused',
};

/**
 * Auto-sourcing (D-118): the targets the runner finds listings for, the shops it searches, its rules, the prices it
 * held, and its runs. The runner itself works on a PC at the hub (tools/sourcing-runner).
 */
export default async function AutoSourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const wanted = (await searchParams).status;
  const status = STATUSES.find((s) => s === wanted) ?? null;
  const [settings, shops, counts, targets, held, runs, drafts] = await Promise.all([
    getSourcingSettings(client),
    listSourcingShops(client),
    countTargets(client),
    listTargets(client, status),
    listHeldSources(client),
    listSourcingRuns(client),
    listSourcedDrafts(client),
  ]);
  const ready = drafts.filter(
    (d) =>
      d.media.length > 0 && attributesSchemaFor(d.product_type).safeParse(d.attributes).success,
  ).length;
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const on = shops.filter((s) => s.is_enabled).map((s) => s.label);

  return (
    <>
      <PageHead
        title="Auto-sourcing"
        back={{ href: '/admin/import', label: 'Import from shops' }}
        sub={`Finds listings for each target on ${on.join(', ') || 'no shop yet'}, adds only pieces at the hub within ${settings.max_delivery_days} days, and checks every sourced listing's price and stock every ${settings.check_every_days} days.`}
      />
      <div className="space-y-5">
        <Panel
          title="Found and waiting"
          note={
            runs[0] ? (
              <>
                last run <When iso={runs[0].finished_at} inline />
              </>
            ) : (
              'no run yet'
            )
          }
        >
          <p className="text-[14px]">
            {drafts.length} draft{drafts.length === 1 ? '' : 's'} found by the runner; {ready} with
            photos and every detail customers must see.{' '}
            <Link href="/admin/catalog?status=draft" className="underline">
              Open the drafts
            </Link>{' '}
            to finish the others.
          </p>
          {ready ? (
            <form action={publishReadyAction} className="mt-3">
              <button type="submit" className={button}>
                Publish the {ready} ready
              </button>
            </form>
          ) : null}
        </Panel>

        <HeldPrices held={held} />

        <Panel
          title={`Targets (${total})`}
          note="best tier first; nothing found is tried again after 30 days"
        >
          <div className="mb-3">
            <TargetsUpload />
          </div>
          <FilterChips
            items={[
              { href: '/admin/import/auto', label: 'All', count: total, on: status === null },
              ...STATUSES.map((s) => ({
                href: `/admin/import/auto?status=${s}`,
                label: STATUS_LABEL[s],
                count: counts[s] ?? 0,
                on: status === s,
              })),
            ]}
          />
          {status === 'none' && counts.none ? (
            <form action={searchNothingFitAgainAction} className="mb-3">
              <button type="submit" className={button}>
                Search all {counts.none} again
              </button>
            </form>
          ) : null}
          {targets.length === 0 ? (
            <p className="text-ink-muted">No targets here.</p>
          ) : (
            <Table head={['Target', 'Category', 'Tier', 'State', 'Found', '']}>
              {targets.map((t) => (
                <tr key={t.id}>
                  <Cell>
                    <b>{t.name}</b>
                    <Sub>
                      {t.region?.name ?? 'All states'} · searched as “{t.query}”
                      {t.must_match ? ` · must say ${t.must_match}` : ''}
                      {t.sites?.length ? ` · on ${t.sites.join(', ')}` : ''}
                      {t.min_price_paise || t.max_price_paise
                        ? ` · ₹${t.min_price_paise ? t.min_price_paise / 100 : 0}–${t.max_price_paise ? `₹${t.max_price_paise / 100}` : 'any'}`
                        : ''}
                      {t.listings ? ` · ${t.listings} listings` : ''}
                    </Sub>
                  </Cell>
                  <Cell>
                    {t.category?.name}
                    <Sub>{PRODUCT_TYPE_LABEL[t.product_type]}</Sub>
                  </Cell>
                  <Cell>{t.tier ?? '—'}</Cell>
                  <Cell className="max-w-[280px]">
                    {STATUS_LABEL[t.status]}
                    {t.note ? <Sub>{t.note}</Sub> : null}
                    {t.searched_at ? (
                      <Sub>
                        <When iso={t.searched_at} inline />
                      </Sub>
                    ) : null}
                  </Cell>
                  <Cell>{t.found_count}</Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-3">
                      {t.status !== 'queued' && t.status !== 'searching' ? (
                        <form action={setTargetAction.bind(null, t.id, 'queued')}>
                          <button type="submit" className="min-h-11 underline">
                            Search again
                          </button>
                        </form>
                      ) : null}
                      {t.status === 'queued' ? (
                        <form action={setTargetAction.bind(null, t.id, 'paused')}>
                          <button type="submit" className="min-h-11 underline">
                            Pause
                          </button>
                        </form>
                      ) : null}
                      {t.status !== 'searching' ? (
                        <form action={deleteTargetAction.bind(null, t.id)}>
                          <button type="submit" className="text-danger min-h-11 underline">
                            Remove
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </Cell>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <ShopsTable shops={shops} />
        <SettingsForm s={settings} />
        <RunsTable runs={runs} />
      </div>
    </>
  );
}
