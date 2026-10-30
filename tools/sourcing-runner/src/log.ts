import { appendFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './env';

let tag = '';

/** Two runners at once (`--type`): each line says whose it is, "[clothing nishorama.com]". */
export function setLogTag(value: string): void {
  tag = value ? `[${value}] ` : '';
}

const FILE = join(ROOT, 'sourcing.log');
/** Past this the log becomes sourcing.log.1 (the one before is dropped), so it never grows without end. */
const MAX_BYTES = 5_000_000;
let rotated = false;

/** One line per event on the console and in sourcing.log (kept next to the runner, not in git). */
export function log(message: string): void {
  const line = `${new Date().toISOString()} ${tag}${message}`;
  console.log(line);
  try {
    if (!rotated && existsSync(FILE) && statSync(FILE).size > MAX_BYTES) renameSync(FILE, `${FILE}.1`);
    rotated = true;
    appendFileSync(FILE, `${line}\n`);
  } catch {
    // a read-only folder must not stop the run
  }
}

/** One short line: Playwright's colour codes and call log dropped (the admin page shows this). */
export const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    // eslint-disable-next-line no-control-regex
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/\s+Call log:[\s\S]*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);

/** Per-shop counts for the run log (worker_sourcing_log) and the admin's shop health. */
export class ShopStats {
  private readonly shops = new Map<string, { pages: number; failed: number; error?: string }>();

  page(site: string, error?: unknown): void {
    const s = this.shops.get(site) ?? { pages: 0, failed: 0 };
    s.pages += 1;
    if (error !== undefined) {
      s.failed += 1;
      s.error = errorText(error);
    }
    this.shops.set(site, s);
  }

  toJSON(): Record<string, { pages: number; failed: number; error?: string }> {
    return Object.fromEntries(this.shops);
  }
}
