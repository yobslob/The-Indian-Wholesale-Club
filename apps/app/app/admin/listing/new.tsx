import { useRouter } from 'expo-router';

import {
  getPricingSettings,
  listCategories,
  listPricingEstimates,
  listVendors,
  PRICE_SUGGESTION_SETTINGS,
} from '@repo/db/admin';

import { ErrorText, Loading, Screen } from '@/components/ui';
import { ListingForm } from '@/features/admin/listing-form';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** New listing (flows.md §2, C3): the camera flow, saved as a draft for review. */
export default function NewListingScreen(): React.JSX.Element {
  const router = useRouter();
  const { data, error, loading } = useQuery('admin:new-listing', async () => {
    const [vendors, categories, pricing, estimates] = await Promise.all([
      listVendors(supabase, { status: 'active' }),
      listCategories(supabase),
      getPricingSettings(supabase),
      listPricingEstimates(supabase),
    ]);
    return {
      vendors,
      categories,
      pricing: {
        fxInrPerUsd: pricing.fx_inr_per_usd,
        freightCentsPerKg: pricing.freight_cents_per_kg,
        dutyPct: pricing.duty_pct,
        marginPct: pricing.margin_pct,
      },
      pricingEstimated: estimates.some((e) => PRICE_SUGGESTION_SETTINGS.includes(e.setting)),
    };
  });

  return (
    <Screen back={false}>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!data && loading ? <Loading /> : null}
      {data ? <ListingForm data={data} onDone={() => router.replace('/admin/listings')} /> : null}
    </Screen>
  );
}
