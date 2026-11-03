import { test } from '@playwright/test';

import { browseFlow } from './flows';

/** Launch QA plan §8 item 1 on a laptop screen (phone-flows.spec.ts runs it at 375 × 812). */
test('browse: Home → state → product → bag → quantity → remove → empty (§8.1)', async ({ page }) => {
  await browseFlow(page);
});
