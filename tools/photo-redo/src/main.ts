import { PRODUCT_TYPES } from '@repo/shared/domain';

import { audit } from './audit';
import { Db, typeArg } from './db';
import { loadEnv, outDir } from './env';
import { fetchPhotos } from './fetch';
import { allWork } from './items';
import { errorText, log } from './log';
import { publish, sweep } from './publish';
import { review } from './review';
import { Store } from './store';

/**
 * The photo redo (D-163) on the founder's laptop. The GPU work is tools/photo-worker/redo.py; this does the rest:
 *   pnpm photos:redo fetch --type clothing [--limit 30] [--again]   the next photos to do, from the photo store
 *   (.venv\Scripts\python redo.py --type clothing in tools/photo-worker: makes the new photos)
 *   pnpm photos:redo review                    the new photos beside the old ones, approve or reject (local page)
 *   pnpm photos:redo publish --type clothing [--auto]   approved photos go live; replaced ones deleted after 10 min
 *   pnpm photos:redo sweep --type clothing     only the deleting of replaced photos (publish ends with it)
 *   pnpm photos:redo status                    how many photos are at each step
 *   pnpm photos:redo audit [--delete]          what fills the photo store; listing photos no listing shows
 */

const [command, ...args] = process.argv.slice(2);
const flag = (name: string): string | null => (args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null);

function status(out: string): void {
  for (const type of PRODUCT_TYPES) {
    const work = allWork(out, type);
    if (!work.length) continue;
    const n = (f: (w: (typeof work)[number]) => boolean) => work.filter(f).length;
    log(
      `${type}: ${work.length} fetched, ${n((w) => !w.result)} for the GPU, ${n((w) => w.result?.status === 'made')} made ` +
        `(${n((w) => w.result?.status === 'made' && !!w.result.pass)} passed the checks), ` +
        `${n((w) => w.result?.status === 'none')} nothing to change, ${n((w) => w.result?.status === 'failed')} ` +
        `failed or your call, ${n((w) => !!w.decision?.ok)} approved, ` +
        `${n((w) => w.decision?.ok === false && !w.decision.remove)} rejected or kept, ` +
        `${n((w) => !!w.decision?.remove)} removed, ` +
        `${n((w) => !!w.item.published?.path)} live, ${n((w) => !!w.item.stale)} changed meanwhile`,
    );
  }
}

async function main(): Promise<number> {
  if (command === 'status') return status(outDir()), 0;
  if (command === 'review') return review(outDir()).then(() => 0);
  if (!['fetch', 'publish', 'sweep', 'audit'].includes(command ?? '')) {
    console.log(
      'Usage: pnpm photos:redo fetch --type clothing|food|home [--limit 30] [--again] | review | ' +
        'publish --type … [--auto] | sweep --type … | status | audit [--delete]',
    );
    return 2;
  }
  const env = loadEnv();
  const db = await Db.signIn(env);
  const store = new Store(env);
  const out = env.IWC_REDO_OUT;
  if (command === 'audit') await audit(out, db, store, args.includes('--delete'));
  else {
    const type = typeArg(flag('--type'));
    if (command === 'fetch')
      await fetchPhotos(out, db, store, type, { limit: Number(flag('--limit')) || 30, again: args.includes('--again') });
    else if (command === 'publish') await publish(out, db, store, type, args.includes('--auto'));
    else await sweep(out, db, store, type);
  }
  db.close();
  return 0;
}

// the exit code is set, not forced: process.exit() while a request's socket is closing trips a libuv assertion
// on Windows (Node 24)
main().then(
  (code) => (process.exitCode = code),
  (error) => {
    log(`stopped: ${errorText(error)}`);
    process.exitCode = 1;
  },
);
