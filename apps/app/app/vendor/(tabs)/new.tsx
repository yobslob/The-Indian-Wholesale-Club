import { vendorCategories } from '@repo/db/vendor';

import { ErrorText, Loading, Screen } from '@/components/ui';
import { useVendor } from '@/features/vendor/context';
import { NewPiece } from '@/features/vendor/new-piece';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

/** Add a piece (D-103): the guided three photos, then sizes and price. */
export default function NewPieceScreen(): React.JSX.Element {
  const { w } = useVendor();
  const { data, error } = useQuery('vendor:new', async () => {
    const [categories, account] = await Promise.all([vendorCategories(supabase), supabase.from('vendor_accounts').select('vendor_id').maybeSingle()]);
    // Clothing first (what most shops sell); spices after.
    const sorted = [...categories].sort((a, b) => (a.product_type === b.product_type ? 0 : a.product_type === 'clothing' ? -1 : 1));
    return { categories: sorted, vendorId: account.data?.vendor_id ?? null };
  });
  return (
    <Screen back={false} title={w('add_piece')}>
      {error ? <ErrorText>{error}</ErrorText> : !data ? <Loading /> : data.vendorId ? <NewPiece vendorId={data.vendorId} categories={data.categories} /> : <ErrorText>{w('try_again')}</ErrorText>}
    </Screen>
  );
}
