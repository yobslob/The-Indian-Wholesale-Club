import { weighAllFood } from '@repo/shared/sourcing/estimate';

import { errorText, log } from './log';

import type { Db } from './db';

/**
 * D-133, D-135: every food listing not yet worked out gets its real weight at the end of each run: the net quantity
 * its label states, unit by unit, no packaging. Never over a weight weighed at the hub or typed by an admin.
 * `all` works them all out again (after the rule changes). Returns how many options changed.
 */
export async function weighFood(db: Db, all = false): Promise<number> {
  try {
    const pass = await weighAllFood(db, { all, dry: false, log });
    if (pass.listings)
      log(
        `food weights: ${pass.written} of ${pass.options} options set to their label's net weight` +
          (pass.noNet
            ? `, ${pass.noNet} state no net quantity (they keep what they have; weigh them at the hub)`
            : ''),
      );
    return pass.written;
  } catch (error) {
    log(`food weights: ${errorText(error)}`);
    return 0;
  }
}
