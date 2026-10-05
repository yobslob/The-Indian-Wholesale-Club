import { getPricingSettings, listPricingEstimates } from '@repo/db/admin';

import { updatePricingSettingsAction } from '@/features/admin/actions/settings';
import { EstimateNote } from '@/features/admin/estimate-note';
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
  const [s, estimates] = await Promise.all([getPricingSettings(client), listPricingEstimates(client)]);
  return (
    <div className="space-y-6">
      <PageTitle>Settings</PageTitle>
      <p className="text-ink-muted">
        Last updated {utc(s.updated_at)}. Leave a field empty if it is not decided yet.
      </p>
      {estimates.length > 0 ? (
        <p className="text-caution max-w-2xl">
          {estimates.length} setting{estimates.length === 1 ? ' holds' : 's hold'} Claude&apos;s researched estimates
          (D-047), each with its source below. Saving your own number removes its label. The site cannot go live while
          an estimate is left.
        </p>
      ) : null}
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
          <EstimateNote estimates={estimates} setting="domestic_days_min" />
        </Field>
        <Field label="US delivery days after arrival: max">
          <input
            name="domesticMax"
            type="number"
            min="0"
            defaultValue={plain(s.domestic_days_max)}
            className={input}
          />
          <EstimateNote estimates={estimates} setting="domestic_days_max" />
        </Field>
        <Field label="Days between cutoffs (D-063; empty = copy the last gap)">
          <input
            name="cycleDays"
            type="number"
            min="1"
            max="90"
            defaultValue={plain(s.cycle_days)}
            className={input}
          />
        </Field>
        <p className="text-ink-muted self-end text-sm">
          When a cycle closes at its cutoff, the next one opens with its cutoff, export and arrival moved forward by
          this many days. Correct them on the cycle if needed.
        </p>
        <Field label="Faster-delivery offer ($, D-064; empty = no offer)">
          <input
            name="fastOffer"
            type="number"
            step="0.01"
            min="0.01"
            defaultValue={dollars(s.fast_offer_cents)}
            className={input}
          />
        </Field>
        <p className="text-ink-muted self-end text-sm">
          What a customer pays for the earlier window when their order left with an earlier export. Without it they
          just hear it came sooner.
        </p>
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
          <EstimateNote estimates={estimates} setting="fx_inr_per_usd" />
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
          <EstimateNote estimates={estimates} setting="freight_cents_per_kg" />
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
          <EstimateNote estimates={estimates} setting="duty_pct" />
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
          <EstimateNote estimates={estimates} setting="margin_pct" />
        </Field>
        <Field label="Listing quantity counts as stale after (days)">
          <input
            name="staleDays"
            type="number"
            min="1"
            defaultValue={plain(s.stale_listing_days)}
            className={input}
          />
          <EstimateNote estimates={estimates} setting="stale_listing_days" />
        </Field>
        <Field label="Leaving soon lists pieces with at most this many left (D-056)">
          <input
            name="leavingSoonMax"
            type="number"
            min="1"
            max="20"
            required
            defaultValue={s.leaving_soon_max}
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
