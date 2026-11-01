import { PRODUCT_TYPES } from '@repo/shared/domain';

import { Db, typeArg } from './db';
import { dbEnv, modelEnv, outDir } from './env';
import { fetchListings, tryListings } from './fetch';
import { allWork, type Work } from './items';
import { errorText, log } from './log';
import { make } from './make';
import { Ollama } from './ollama';
import { publish } from './publish';
import { review } from './review';

/**
 * The description redo (D-178) on the founder's laptop: every listing's summary and description written again by a
 * local model, checked, reviewed, then published.
 *   pnpm descriptions:redo fetch [--type food] [--limit 200] [--again]   the next listings to do, from the database
 *   pnpm descriptions:redo make [--type …] [--retry] [--again]           new words on the GPU (Ollama)
 *   pnpm descriptions:redo run [--type …] [--limit 2000]                 fetch and make, page after page
 *   pnpm descriptions:redo review                                        old and new side by side (local page)
 *   pnpm descriptions:redo publish [--type …] [--auto]                   approved words go live
 *   pnpm descriptions:redo status                                        how many listings are at each step
 *   pnpm descriptions:redo try [--type …] [--limit 20] --out <folder>     live listings from the store, never published
 * Every command takes `--out <folder>` (default tools/description-redo/out).
 */

const [command, ...args] = process.argv.slice(2);
const flag = (name: string): string | null =>
  args.includes(name) ? (args[args.indexOf(name) + 1] ?? null) : null;

function status(out: string): void {
  const all = allWork(out);
  if (!all.length) return log(`status: nothing in ${out} yet (fetch first)`);
  for (const type of PRODUCT_TYPES) {
    const work = all.filter((w) => w.item.type === type);
    if (!work.length) continue;
    const n = (f: (w: Work) => boolean) => work.filter(f).length;
    log(
      `${type}: ${work.length} fetched, ${n((w) => !w.result && !w.item.published)} to write, ` +
        `${n((w) => w.result?.status === 'made')} passed the checks, ${n((w) => w.result?.status === 'flagged')} ` +
        `flagged, ${n((w) => w.result?.status === 'failed')} failed, ${n((w) => !!w.decision?.ok && !w.decision.words)} ` +
        `approved, ${n((w) => !!w.decision?.words)} edited, ${n((w) => w.decision?.ok === false)} rejected, ` +
        `${n((w) => !!w.item.published)} live, ${n((w) => !!w.item.stale)} changed meanwhile` +
        (n((w) => !!w.item.trial) ? ` (${n((w) => !!w.item.trial)} trial)` : ''),
    );
  }
  const timed = all.filter((w) => w.result).map((w) => w.result!);
  if (timed.length)
    log(
      `written: ${timed.length}, ${(timed.reduce((s, r) => s + r.tries, 0) / timed.length).toFixed(2)} tries and ` +
        `${Math.round(timed.reduce((s, r) => s + r.tokens, 0) / timed.length)} tokens each on average`,
    );
}

async function main(): Promise<number> {
  const out = outDir(flag('--out'));
  const type = typeArg(flag('--type'));
  const limit = (fallback: number): number => Number(flag('--limit')) || fallback;
  const writing = () => {
    const env = modelEnv();
    return { ollama: new Ollama(env), parallel: env.IWC_DESC_PARALLEL };
  };
  const makeOpts = { again: args.includes('--again'), retry: args.includes('--retry') };
  switch (command) {
    case 'status':
      return (status(out), 0);
    case 'review':
      return review(out).then(() => 0);
    case 'try':
      await tryListings(out, dbEnv(), type, {
        limit: limit(20),
        skip: Number(flag('--skip')) || 0,
      });
      return 0;
    case 'make': {
      const { ollama, parallel } = writing();
      await make(out, ollama, type, { ...makeOpts, limit: limit(Infinity), parallel });
      return 0;
    }
    case 'fetch':
    case 'run':
    case 'publish': {
      const db = await Db.signIn(dbEnv());
      try {
        if (command === 'fetch')
          await fetchListings(out, db, type, { limit: limit(200), again: makeOpts.again });
        else if (command === 'publish')
          await publish(out, db, type, { auto: args.includes('--auto') });
        else {
          // continuous: what is waiting written, then 100 more fetched and written, until the limit or the end
          const { ollama, parallel } = writing();
          const opts = { again: false, retry: false, limit: Infinity, parallel };
          await make(out, ollama, type, opts);
          for (let left = limit(Infinity); left > 0;) {
            const ids = await fetchListings(out, db, type, {
              limit: Math.min(100, left),
              again: false,
            });
            if (!ids.length) break;
            left -= ids.length;
            await make(out, ollama, type, opts);
          }
        }
      } finally {
        db.close();
      }
      return 0;
    }
    default:
      console.log(
        'Usage: pnpm descriptions:redo fetch|make|run|review|publish|status|try [--type clothing|food|home] ' +
          '[--limit n] [--again] [--retry] [--auto] [--out folder]',
      );
      return 2;
  }
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
