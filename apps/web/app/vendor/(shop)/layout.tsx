import { requireVendorPage } from '@/features/vendor/guard';
import { VendorShell } from '@/features/vendor/shell';

/** Every vendor page passes the server check first (D-103): signed in and a vendor account, else the sign-in page. */
export default async function VendorShopLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { me, lang } = await requireVendorPage();
  return (
    <VendorShell lang={lang} shopName={me.shop_name}>
      {children}
    </VendorShell>
  );
}
