import { infoBlocks } from '@repo/shared/info';

import { getStorePolicyCached } from '@/features/catalog/data';
import { supportEmail } from '@/lib/env';

import { InfoBlocks } from './info-blocks';

/**
 * This page's wording comes from @repo/shared/info, one source with the app's help sheet (D-095); every number from
 * store_policy(), the same settings the rules apply (D-008).
 */
export async function FaqText(): Promise<React.JSX.Element> {
  const policy = await getStorePolicyCached();
  return <InfoBlocks blocks={infoBlocks('faq', { policy, email: supportEmail() })} />;
}
