import { checkRewrite } from '@repo/shared/sourcing/describe';

import { allWork, tidy, wordsOf, writeItem, type Work } from './items';
import { errorText, log } from './log';

import type { Db } from './db';
import type { ProductType } from '@repo/shared/domain';

/** Writes at once: each is one small call, so the database's free plan never notices. */
const AT_ONCE = 4;

/** Ready to go live: approved or edited on the review page, or with --auto passed the checks and not rejected. */
const approved = (w: Work, auto: boolean): boolean =>
  !w.item.published &&
  !w.item.stale &&
  !w.item.trial &&
  !!wordsOf(w) &&
  (w.decision ? w.decision.ok : auto && w.result?.status === 'made');

/**
 * `publish`: every approved listing's new words go live, one small write each, only while the listing still has the
 * words read (else it is left alone and the next `fetch` takes it again as it is now). The founder's edit goes out
 * as `edited`; nothing goes out with a price, a link, a shop's name or an emoji, edited or not.
 */
export async function publish(
  out: string,
  db: Db,
  type: ProductType | null,
  opts: { auto: boolean },
): Promise<void> {
  const ready = allWork(out, type).filter((w) => approved(w, opts.auto));
  const counts = { live: 0, changed: 0, refused: 0, errors: 0 };
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < ready.length) {
      const w = ready[next++]!;
      const words = wordsOf(w)!;
      const hard = checkRewrite(w.item, words).hard;
      if (hard.length) {
        counts.refused += 1;
        log(`  ${w.item.name}: not published: ${hard.join('; ')}`);
        continue;
      }
      try {
        const redo = w.decision?.words ? 'edited' : 'rewritten';
        if (await db.set(w.item.product_id, w.item.hash, words, redo)) {
          writeItem(w.dir, { ...w.item, published: { at: new Date().toISOString(), redo } });
          tidy(w.dir);
          counts.live += 1;
        } else {
          writeItem(w.dir, { ...w.item, stale: true });
          counts.changed += 1;
          log(
            `  ${w.item.name}: its words changed since they were fetched (or are done); left alone`,
          );
        }
      } catch (error) {
        counts.errors += 1;
        log(`  ${w.item.name}: ${errorText(error)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, ready.length) }, worker));
  const waiting = allWork(out, type).filter(
    (w) => !w.item.published && !w.item.stale && !w.item.trial,
  ).length;
  log(
    `publish: ${counts.live} listings' new words live, ${counts.changed} changed meanwhile, ${counts.refused} ` +
      `refused, ${counts.errors} errors; ${waiting} waiting for review or work`,
  );
}
