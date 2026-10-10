import { vendorCategories } from '@repo/db/vendor';
import { t } from '@repo/shared/vendor';

import { requireVendorPage } from '@/features/vendor/guard';
import { NewPiece } from '@/features/vendor/new-piece';
import { VendorTitle } from '@/features/vendor/shell';

/** Add a piece (D-103): the guided three photos, then sizes and price. */
export default async function NewPiecePage(): Promise<React.JSX.Element> {
  const { client, lang } = await requireVendorPage();
  const [categories, { data: account }] = await Promise.all([
    vendorCategories(client),
    client.from('vendor_accounts').select('vendor_id').maybeSingle(),
  ]);
  if (!account) throw new Error('vendor account missing');
  // Clothing first (what most shops sell); spices after (they wait for D-032 to go live, but can be sent).
  const sorted = [...categories].sort((a, b) => (a.product_type === b.product_type ? 0 : a.product_type === 'clothing' ? -1 : 1));
  return (
    <>
      <VendorTitle>{t(lang, 'add_piece')}</VendorTitle>
      <NewPiece lang={lang} vendorId={account.vendor_id} categories={sorted} />
    </>
  );
}
