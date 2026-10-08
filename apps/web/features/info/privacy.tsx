import { infoBlocks } from '@repo/shared/info';

import { supportEmail } from '@/lib/env';

import { InfoBlocks } from './info-blocks';

/**
 * This page's wording comes from @repo/shared/info, one source with the app's help sheet (D-095); the support
 * address from NEXT_PUBLIC_CONTACT_EMAIL (Q-9).
 */
export function PrivacyText(): React.JSX.Element {
  return <InfoBlocks blocks={infoBlocks('privacy', { email: supportEmail() })} />;
}
