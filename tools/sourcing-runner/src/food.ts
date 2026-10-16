import { weighAllFood } from '@repo/shared/sourcing/estimate';

import { errorText, log } from './log';

import type { Db } from './db';

/**
 * D-133: every food listing not yet worked out (after the deploy: all of them) gets its packed weight at the end of
 * each run: its net quantity plus its pack, tuned on the food the hub has weighed. Never over a weight weighed at
 * the hub or typed by an admin. Returns how many options changed.
 */
export async function weighFood(db: Db, all = false): Promise<number> {
  try {
    const pass = await weighAllFood(db, { all, dry: false, log });
    const tuned = Object.entries(pass.factors)
      .map(([pack, f]) => `${pack} ×${f.toFixed(2)}`)
      .join(', ');
    if (pass.listings)
      log(
        `food weights: ${pass.written} of ${pass.options} options worked out (net quantity + pack)` +
          (pass.noNet
            ? `, ${pass.noNet} state no net quantity (they keep what they have; weigh them at the hub)`
            : '') +
          (tuned ? `; packs tuned by the hub's scale: ${tuned}` : ''),
      );
    return pass.written;
  } catch (error) {
    log(`food weights: ${errorText(error)}`);
    return 0;
  }
}
