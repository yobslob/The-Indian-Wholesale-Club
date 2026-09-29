import { getPricingSettings } from '@repo/db/admin';

import { updatePricingSettingsAction } from '@/features/admin/actions/settings';
import { requireAdminPage } from '@/features/admin/guard';
import { button, Field, input, PageTitle, utc } from '@/features/admin/ui';

const dollars = (cents: number | null) => (cents === null ? '' : (cents / 100).toFixed(2));
const plain = (value: number | null) => (value === null ? '' : String(value));

/**
 * Settings: the numbers the founder decides (D-047, D-041, Q-18). Empty = not decided;
 * checkout stays closed until domestic delivery days and shipping are set.
 * Admin accounts are managed in the database + ADMIN_EMAILS (docs/ops.md).
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const { client } = await requireAdminPage();
  const s = await getPricingSettings(client);
  return (
    <div className="space-y-6">
      <PageTitle>Settings</PageTitle>
      <p className="text-ink-muted">
        Last updated {utc(s.updated_at)}. Leave a field empty if it is not decided yet.
      </p>
      <form action={updatePricingSettingsAction} className="grid max-w-2xl gap-3 sm:grid-cols-2">
        <h2 className="font-medium sm:col-span-2">Delivery (shown to customers, D-008)</h2>
        <Field label="US delivery days after arrival: min">
          <input
            name="domesticMin"
            type="number"
            min="0"
            defaultValue={plain(s.domestic_days_min)}
            className={input}
          />
        </Field>
        <Field label="US delivery days after arrival: max">
          <input
            name="domesticMax"
            type="number"
            min="0"
            defaultValue={plain(s.domestic_days_max)}
            className={input}
          />
        </Field>
        <h2 className="font-medium sm:col-span-2">Shipping (D-041: standard free, express $8)</h2>
        <Field label="Standard shipping per order ($, 0 = free)">
          <input
            name="shippingFlat"
            type="number"
            step="0.01"
            min="0"
            defaultValue={dollars(s.shipping_flat_cents)}
            className={input}
          />
        </Field>
        <Field label="Free shipping from ($, empty = never)">
          <input
            name="freeShippingMin"
            type="number"
            step="0.01"
            min="0"
            defaultValue={dollars(s.free_shipping_min_cents)}
            className={input}
          />
        </Field>
        <Field label="Express shipping per order ($)">
          <input
            name="expressShipping"
            type="number"
            step="0.01"
            min="0"
            defaultValue={dollars(s.express_shipping_cents)}
            className={input}
          />
        </Field>
        <p className="text-ink-muted sm:col-span-2">
          Express is offered only when both express delivery days are set (Q-18).
        </p>
        <Field label="Express: US delivery days after arrival, min">
          <input
            name="expressMin"
            type="number"
            min="0"
            defaultValue={plain(s.express_days_min)}
            className={input}
          />
        </Field>
        <Field label="Express: US delivery days after arrival, max">
          <input
            name="expressMax"
            type="number"
            min="0"
            defaultValue={plain(s.express_days_max)}
            className={input}
          />
        </Field>
        <h2 className="font-medium sm:col-span-2">Price suggestions (D-047, admin only)</h2>
        <Field label="FX: rupees per US dollar">
          <input
            name="fx"
            type="number"
            step="0.0001"
            min="0"
            defaultValue={plain(s.fx_inr_per_usd)}
            className={input}
          />
        </Field>
        <Field label="Freight per kg ($)">
          <input
            name="freightPerKg"
            type="number"
            step="0.01"
            min="0"
            defaultValue={dollars(s.freight_cents_per_kg)}
            className={input}
          />
        </Field>
        <Field label="Duty %">
          <input
            name="dutyPct"
            type="number"
            step="0.01"
            min="0"
            defaultValue={plain(s.duty_pct)}
            className={input}
          />
        </Field>
        <Field label="Target margin %">
          <input
            name="marginPct"
            type="number"
            step="0.01"
            min="0"
            defaultValue={plain(s.margin_pct)}
            className={input}
          />
        </Field>
        <Field label="Listing quantity counts as stale after (days)">
          <input
            name="staleDays"
            type="number"
            min="1"
            defaultValue={plain(s.stale_listing_days)}
            className={input}
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" className={button}>
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
