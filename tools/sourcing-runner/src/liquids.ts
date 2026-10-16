import { liquidReason } from '@repo/shared/sourcing';

import { errorText, log } from './log';

import type { Db } from './db';

/**
 * D-135: liquids are not sent. Every food and home listing not yet checked (after the deploy: all of them) is looked
 * at once, by its name and options (`liquidReason`); a liquid one is archived and shown to customers as coming soon.
 * Each is checked only once, so an admin who puts one back on sale is not undone (`--all` checks every one again).
 * `dry` lists them and writes nothing. Returns how many were archived.
 */
export async function checkLiquids(db: Db, opts: { dry: boolean; all?: boolean }): Promise<number> {
  let after: string | null = null;
  let archived = 0;
  let checked = 0;
  try {
    for (;;) {
      const page = await db.liquidPlan(after, opts.all ?? false);
      if (!page.length) break;
      after = page[page.length - 1]!.product_id;
      const items = page.map((l) => {
        const note = liquidReason({ type: l.product_type, name: l.name, labels: l.labels });
        if (note)
          log(
            `  ${opts.dry ? 'would archive' : 'coming soon'} (${l.status}): "${l.name.slice(0, 70)}": ${note}`,
          );
        return { product_id: l.product_id, liquid: !!note, note };
      });
      checked += items.length;
      if (!opts.dry) archived += await db.setLiquids(items);
      else archived += items.filter((i) => i.liquid).length;
      if (page.length < 200) break;
    }
  } catch (error) {
    log(`liquids: ${errorText(error)}`);
  }
  if (checked)
    log(
      `liquids: ${checked} listings checked, ${archived} liquid${archived === 1 ? '' : 's'} ` +
        (opts.dry ? 'found (--dry: nothing written)' : 'archived and shown as coming soon'),
    );
  return archived;
}
