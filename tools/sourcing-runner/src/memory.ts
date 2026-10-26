import { spawn } from 'node:child_process';
import { getHeapStatistics } from 'node:v8';

import { log } from './log';

/**
 * A long run must not die of memory. On 2026-10-26 a home run stopped after 5.7 hours with "JavaScript heap out of
 * memory" (Node's ~4 GB), leaving its claimed targets held for 6 hours. Three guards: photo answers are released
 * (photos.ts), each shop's tab is replaced now and then (lanes.ts), and a run whose memory passes RESTART_AT stops
 * between target batches, hands its targets back and exits with RESTART_CODE; `pnpm sourcing run` runs it in a child
 * process (keepRunning) and starts a fresh one, which claims the rest.
 */

const RESTART_AT = 0.6;
export const RESTART_CODE = 75;
/** Crashes (not memory restarts) in a row before the runner gives up. */
const MAX_CRASHES = 3;
const CHILD = 'IWC_SOURCING_CHILD';

const gb = (bytes: number): string => (bytes / 2 ** 30).toFixed(1);

/** Node's heap and its buffers (photo bodies live outside the heap but count towards the crash). */
const used = (): number => {
  const m = process.memoryUsage();
  return m.heapUsed + m.external;
};

/** "memory 1.2 of 4.2 GB", for the log. */
export function heapText(): string {
  return `memory ${gb(used())} of ${gb(getHeapStatistics().heap_size_limit)} GB`;
}

/** This run should hand over to a fresh process before Node runs out of memory. */
export function heapFull(): boolean {
  return used() > getHeapStatistics().heap_size_limit * RESTART_AT;
}

export const isChild = (): boolean => process.env[CHILD] === '1';

/**
 * Runs this same command (`run` and its flags) in a child Node process until it ends for good: started again at once
 * after a memory restart, after 60 s after a crash (up to MAX_CRASHES in a row). Ctrl+C reaches both; the child hands
 * its targets back (D-149) and this waits for it.
 */
export async function keepRunning(): Promise<number> {
  let stopping = false;
  process.on('SIGINT', () => (stopping = true));
  process.on('SIGTERM', () => (stopping = true));
  for (let crashes = 0; ;) {
    const code = await new Promise<number>((resolve) => {
      const child = spawn(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        stdio: 'inherit',
        env: { ...process.env, [CHILD]: '1' },
      });
      child.on('error', () => resolve(1));
      child.on('exit', (exit) => resolve(exit ?? 1));
    });
    if (stopping || code === 0 || code === 1 || code === 2 || code === 130) return code;
    if (code === RESTART_CODE) {
      crashes = 0;
      log('run: starting a fresh runner for the targets left');
      continue;
    }
    crashes += 1;
    if (crashes > MAX_CRASHES) {
      log(`run: the runner stopped (exit ${code}) ${MAX_CRASHES + 1} times in a row; giving up`);
      return code;
    }
    // a crash leaves its claimed targets held (the database queues them again after 6 hours); the rest are claimed
    log(`run: the runner stopped (exit ${code}); starting again in 60 s`);
    await new Promise((r) => setTimeout(r, 60_000));
    if (stopping) return code;
  }
}
