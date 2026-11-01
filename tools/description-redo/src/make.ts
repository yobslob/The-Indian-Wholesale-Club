import {
  checkRewrite,
  describeAnswerSchema,
  describePrompt,
  DESCRIBE_SYSTEM,
  readDescribeAnswer,
} from '@repo/shared/sourcing/describe';

import { allWork, clearDecision, writeResult, type Result, type Work } from './items';
import { errorText, log } from './log';

import type { Ollama } from './ollama';
import type { ProductType } from '@repo/shared/domain';

/** A rewrite that fails its checks is asked again with the reasons this many times in all, then left for review. */
const TRIES = 3;

/**
 * Which listings `make` writes: those not written yet and those rejected on the review page; `retry` adds the
 * flagged and failed ones; `again` every one not approved and not live. Approved and live ones are never redone.
 */
function wanted(w: Work, opts: { again: boolean; retry: boolean }): boolean {
  if (w.item.published || w.item.stale || w.decision?.ok) return false;
  if (!w.result || w.decision?.ok === false || opts.again) return true;
  return opts.retry && w.result.status !== 'made';
}

/** One listing: up to three tries, each told why the last was not accepted; the best one is kept. */
async function write(ollama: Ollama, w: Work): Promise<Result> {
  const started = Date.now();
  const round = (w.result?.round ?? 0) + 1;
  let best: Pick<Result, 'words' | 'failures' | 'overlap' | 'run'> | null = null;
  let feedback: string[] = [];
  let tokens = 0;
  let tries = 0;
  let error = '';
  for (; tries < TRIES;) {
    tries += 1;
    try {
      const answer = await ollama.ask(
        DESCRIBE_SYSTEM,
        describePrompt(w.item, feedback),
        describeAnswerSchema,
        round * 100 + tries,
      );
      tokens += answer.tokens;
      const words = readDescribeAnswer(answer.content);
      if (!words) {
        feedback = ['the answer was not the JSON asked for'];
        continue;
      }
      const check = checkRewrite(w.item, words);
      const score = (c: { failures: string[]; overlap: number }) => c.failures.length + c.overlap;
      if (!best || score(check) < score(best)) best = { words, ...check };
      if (check.pass) break;
      feedback = check.failures;
    } catch (e) {
      error = errorText(e);
    }
  }
  return {
    status: !best ? 'failed' : best.failures.length ? 'flagged' : 'made',
    words: best?.words ?? null,
    failures: best?.failures ?? [error || 'no answer'],
    overlap: best?.overlap ?? 0,
    run: best?.run ?? 0,
    tries,
    round,
    seconds: (Date.now() - started) / 1000,
    tokens,
    model: ollama.model,
    at: new Date().toISOString(),
  };
}

/**
 * `make`: new words for every listing waiting in the work folder, `parallel` at a time on the GPU (Ollama answers
 * them together). Says how fast it goes every 25 listings. Stops cleanly between listings: run it again to carry on.
 */
export async function make(
  out: string,
  ollama: Ollama,
  type: ProductType | null,
  opts: { again: boolean; retry: boolean; limit: number; parallel: number },
): Promise<{ made: number; flagged: number; failed: number }> {
  const problem = await ollama.problem();
  if (problem) throw new Error(problem);
  const todo = allWork(out, type)
    .filter((w) => wanted(w, opts))
    .slice(0, opts.limit);
  const counts = { made: 0, flagged: 0, failed: 0 };
  if (!todo.length) {
    log('make: nothing waiting (fetch more, or --retry the flagged ones)');
    return counts;
  }
  log(`make: ${todo.length} listings with ${ollama.model}, ${opts.parallel} at a time`);
  const started = Date.now();
  let done = 0;
  let tokens = 0;
  let next = 0;
  const pace = (): string => {
    const minutes = (Date.now() - started) / 60_000;
    return `${(done / minutes).toFixed(1)} listings a minute, ${Math.round(tokens / (minutes * 60))} tokens a second`;
  };
  const worker = async (): Promise<void> => {
    while (next < todo.length) {
      const w = todo[next++]!;
      const result = await write(ollama, w);
      if (w.decision?.ok === false) clearDecision(w.dir);
      writeResult(w.dir, result);
      counts[result.status] += 1;
      done += 1;
      tokens += result.tokens;
      if (result.status !== 'made')
        log(`  ${w.item.name}: ${result.status}: ${result.failures.join('; ')}`);
      if (done % 25 === 0) log(`  ${done} of ${todo.length}: ${pace()}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(opts.parallel, todo.length) }, worker));
  log(
    `make: ${counts.made} passed the checks, ${counts.flagged} flagged for you, ${counts.failed} failed; ${pace()} ` +
      `(${Math.round((Date.now() - started) / 1000)} s)`,
  );
  return counts;
}
