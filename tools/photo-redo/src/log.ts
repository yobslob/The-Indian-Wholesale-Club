import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './env';

/** One line per event on the console and in redo.log (next to the tool, not in git). */
export function log(message: string): void {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    appendFileSync(join(ROOT, 'redo.log'), `${line}\n`);
  } catch {
    // a read-only folder must not stop the work
  }
}

export const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 300);
