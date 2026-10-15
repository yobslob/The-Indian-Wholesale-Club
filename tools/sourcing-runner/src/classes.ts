import { classifyClothing, classWrites, type ClassWrite } from '@repo/shared/sourcing/estimate';

import { errorText, log } from './log';

import type { Db } from './db';

/**
 * D-132: new clothing gets its class weight at the end of each run (light 350 g, medium 750 g, pants and footwear
 * 800 g, heavy 1.5 kg), by the name rules and the category only: this PC has no model. A name neither reads waits for
 * `pnpm weights classes` on the laptop. Returns how many options got their class weight.
 */
export async function sortNewClothing(db: Db): Promise<number> {
  let after: string | null = null;
  let written = 0;
  let unsorted = 0;
  try {
    for (;;) {
      const page = await db.clothingPlan(after);
      if (!page.length) break;
      after = page[page.length - 1]!.product_id;
      const writes: ClassWrite[] = [];
      for (const listing of page) {
        const rule = classifyClothing({ name: listing.name, categorySlug: listing.category_slug });
        if (rule) writes.push(...classWrites(listing, rule.cls, rule.why));
        else unsorted += 1;
      }
      for (let i = 0; i < writes.length; i += 500)
        written += await db.setClassWeights(writes.slice(i, i + 500));
    }
  } catch (error) {
    log(`clothing classes: ${errorText(error)}`);
  }
  if (written || unsorted)
    log(
      `clothing classes: ${written} options weighed by class${unsorted ? `, ${unsorted} listings for the laptop to sort` : ''}`,
    );
  return written;
}
