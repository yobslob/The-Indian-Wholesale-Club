import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ROOT } from './env';

/**
 * D-171 (founder 2026-10-31: "7.3GB is filled in R2 se we got only 2GB left"): `pnpm sourcing run --photo-gb 1.8`
 * lets one run write at most that much to the photo store. Both AVIF copies of every photo count as they are written
 * (photo-store.ts); once the budget is spent no new listing is started and the targets not reached go back to the
 * queue. The count lives in out/photo-budget.json, so a fresh runner (memory.ts) carries on with what is left; a run
 * without the flag removes the file (no cap). A listing already started finishes, so a run can pass its budget by one
 * listing's photos (about 1 MB).
 */

const FILE = join(ROOT, 'out', 'photo-budget.json');
const GB = 1024 ** 3;

interface Saved {
  limit_bytes: number;
  used_bytes: number;
  started_at: string;
}

/** The run's start (the parent process, before its runners): a new budget, or none. */
export function startBudget(gb: number | null): void {
  if (gb === null) {
    rmSync(FILE, { force: true });
    return;
  }
  if (!(gb > 0 && gb <= 100)) throw new Error('--photo-gb is the photo store space this run may use, in GB (1.8)');
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  const saved: Saved = { limit_bytes: Math.round(gb * GB), used_bytes: 0, started_at: new Date().toISOString() };
  writeFileSync(FILE, JSON.stringify(saved, null, 2));
}

export class PhotoBudget {
  private constructor(private saved: Saved) {}

  /** The budget the run started with, or null when it has none. */
  static load(): PhotoBudget | null {
    try {
      const saved = JSON.parse(readFileSync(FILE, 'utf8')) as Saved;
      return saved.limit_bytes > 0 ? new PhotoBudget(saved) : null;
    } catch {
      return null;
    }
  }

  add(bytes: number): void {
    if (bytes <= 0) return;
    this.saved = { ...this.saved, used_bytes: this.saved.used_bytes + bytes };
    writeFileSync(FILE, JSON.stringify(this.saved, null, 2));
  }

  get spent(): boolean {
    return this.saved.used_bytes >= this.saved.limit_bytes;
  }

  text(): string {
    return `${(this.saved.used_bytes / GB).toFixed(2)} of ${(this.saved.limit_bytes / GB).toFixed(2)} GB of photos`;
  }
}
