import { getPricingSettings, listBusinessDetails, listPricingEstimates } from '@repo/db/admin';

import { updateBusinessDetailsAction, updatePricingSettingsAction, updateSpicesClearedAction } from '@/features/admin/actions/settings';
import { EstimateNote } from '@/features/admin/estimate-note';
import { requireAdminPage } from '@/features/admin/guard';
import { displayValue, SETTING_GROUPS } from '@/features/admin/settings-fields';
import { button, Field, input, PageHead, SectionTitle, When } from '@/features/admin/ui';

/**
 * Settings: every number that prices and delivers an order (D-069: the pilot's high-end placeholders, each labelled
 * with its basis until the founder saves their own; the full list is docs/pilot-numbers.md). Prices follow from them
 * automatically (D-075). Business and compliance details for the invoice and spices (D-074) below.
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [s, estimates, details] = await Promise.all([
    getPricingSettings(client),
    listPricingEstimates(client),
    listBusinessDetails(client),
  ]);
  const row = s as unknown as Record<string, number | null>;
  const placeholders = details.filter((d) => d.is_placeholder).length;
  const groups = [...new Set(details.map((d) => d.group_name))];

  return (
    <div className="space-y-8">
      <PageHead title="Settings" />
      <p className="text-ink-muted max-w-2xl">
        Last updated <When iso={s.updated_at} inline />. Prices are worked out from these numbers by themselves (D-075). The exchange
        rate updates every day
        {s.fx_updated_at ? <> (last <When iso={s.fx_updated_at} inline />{s.fx_source ? `, ${s.fx_source}` : ''})</> : ''}.
      </p>
      {estimates.length > 0 ? (
        <p className="text-caution max-w-2xl">
          {estimates.length} number{estimates.length === 1 ? ' is a placeholder' : 's are placeholders'} for the pilot
          (D-069), each with its basis below. Saving your own number removes its label; the launch check lists what is
          left.
        </p>
      ) : null}

      <form action={updatePricingSettingsAction} className="max-w-3xl space-y-8">
        {SETTING_GROUPS.map((group) => (
          <section key={group.title} className="space-y-3">
            <SectionTitle>{group.title}</SectionTitle>
            {group.note ? <p className="text-ink-muted text-sm">{group.note}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {group.fields.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Field label={f.label}>
                    <input
                      name={f.key}
                      inputMode="decimal"
                      required={f.required}
                      defaultValue={displayValue(f.kind, row[f.key])}
                      className={input}
                    />
                  </Field>
                  <EstimateNote estimates={estimates} setting={f.key} />
                </div>
              ))}
            </div>
          </section>
        ))}
        <button type="submit" className={button}>
          Save numbers
        </button>
      </form>

      <section className="max-w-3xl space-y-3">
        <SectionTitle>Spices (D-032, D-074)</SectionTitle>
        <p className="text-sm">
          {s.spices_cleared
            ? 'Cleared: spice listings can be published.'
            : 'Not cleared: spice listings stay drafts. Fill the FDA details below first, then switch this on.'}
        </p>
        <form action={updateSpicesClearedAction.bind(null, !s.spices_cleared)}>
          <button type="submit" className={s.spices_cleared ? 'min-h-11 underline' : button}>
            {s.spices_cleared ? 'Stop publishing spices' : 'Spices are cleared: allow publishing'}
          </button>
        </form>
      </section>

      <form action={updateBusinessDetailsAction} className="max-w-3xl space-y-6">
        <div className="space-y-1">
          <SectionTitle>Business and compliance details (D-074)</SectionTitle>
          {placeholders > 0 ? (
            <p className="text-caution text-sm">
              {placeholders} still placeholders. They go on the commercial invoice and the spice paperwork.
            </p>
          ) : null}
        </div>
        {groups.map((g) => (
          <fieldset key={g} className="grid gap-4 sm:grid-cols-2">
            <legend className="font-heading text-[15px] font-semibold sm:col-span-2">{g}</legend>
            {details
              .filter((d) => d.group_name === g)
              .map((d) => (
                <Field key={d.key} label={`${d.label}${d.is_placeholder ? ' (placeholder)' : ''}`}>
                  <input name={d.key} defaultValue={d.value} className={input} />
                </Field>
              ))}
          </fieldset>
        ))}
        <button type="submit" className={button}>
          Save details
        </button>
      </form>
    </div>
  );
}
