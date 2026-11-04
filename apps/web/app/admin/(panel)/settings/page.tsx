import { getPricingSettings, listBusinessDetails } from '@repo/db/admin';

import { updateBusinessDetailsAction, updatePricingSettingsAction } from '@/features/admin/actions/settings';
import { requireAdminPage } from '@/features/admin/guard';
import { displayValue, SETTING_GROUPS } from '@/features/admin/settings-fields';
import { button, Field, input, PageHead, SectionTitle, When } from '@/features/admin/ui';

/**
 * Settings: every number that charges and delivers an order (the full list is docs/pilot-numbers.md). Business and
 * compliance details for the invoice and food (D-074) below.
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const [s, details] = await Promise.all([getPricingSettings(client), listBusinessDetails(client)]);
  const row = s as unknown as Record<string, number | null>;
  const placeholders = details.filter((d) => d.is_placeholder).length;
  const groups = [...new Set(details.map((d) => d.group_name))];

  return (
    <div className="space-y-8">
      <PageHead title="Settings" />
      <p className="text-ink-muted max-w-2xl">
        Last updated <When iso={s.updated_at} inline />.
      </p>

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
                  {f.hint ? <p className="text-ink-muted text-[12px] leading-snug">{f.hint}</p> : null}
                </div>
              ))}
            </div>
          </section>
        ))}
        <button type="submit" className={button}>
          Save numbers
        </button>
      </form>

      <form action={updateBusinessDetailsAction} className="max-w-3xl space-y-6">
        <div className="space-y-1">
          <SectionTitle>Business and compliance details (D-074)</SectionTitle>
          {placeholders > 0 ? (
            <p className="text-caution text-sm">
              {placeholders} still placeholders. They go on the food paperwork.
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
