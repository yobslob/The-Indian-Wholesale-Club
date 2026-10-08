import { infoBlocks } from '@repo/shared/info';

import { InfoBlocks } from './info-blocks';

/** This page's wording comes from @repo/shared/info, one source with the app's help sheet (D-095). */
export function HowItWorksText(): React.JSX.Element {
  return <InfoBlocks blocks={infoBlocks('how-it-works', {})} />;
}
