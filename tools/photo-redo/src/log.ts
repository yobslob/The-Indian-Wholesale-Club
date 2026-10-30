import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './env';

const FILE = join(ROOT, 'redo.log');
/** Past this the log becomes redo.log.1 (the one before is dropped), so it never grows without end. */
const MAX_BYTES = 5_000_000;
let rotated = false;

/** One line per event on the console and in redo.log (next to the tool, not in git). */
export function log(message: string): void {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try {
    if (!rotated && existsSync(FILE) && statSync(FILE).size > MAX_BYTES) renameSync(FILE, `${FILE}.1`);
    rotated = true;
    appendFileSync(FILE, `${line}\n`);
  } catch {
    // a read-only folder must not stop the work
  }
}

export const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, ' ').trim().slice(0, 300);
