import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { nextRest, type ShopRest } from '@repo/shared/sourcing/auto';

import { ROOT } from './env';

/**
 * D-149: the shops resting after a robot check, kept on this PC (`shop-rest.json`, not committed) so the next run, and
 * the other runner in the other terminal, leave them alone too. Read again before each write: both runners write it.
 */

const FILE = join(ROOT, 'shop-rest.json');

export function readRests(): Record<string, ShopRest> {
  try {
    const all = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, ShopRest>;
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

/** Rests the shop from now (longer if it rested lately, and at least as long as the shop asked) and returns it. */
export function restShop(
  site: string,
  atLeastMs: number | null = null,
  now = new Date(),
): ShopRest {
  const all = readRests();
  const rest = nextRest(site, all[site], now, atLeastMs);
  all[site] = rest;
  try {
    writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`);
  } catch {
    // this run still leaves the shop alone; the next one may ask it once more
  }
  return rest;
}

/**
 * D-153: when each shop was last asked for a page, so the hourly limit holds for both runners together. Each runner
 * writes only its own file (`out/pace/<process id>.json`, no two writers on one file) and reads them all; an hour-old
 * file is a finished runner's and is removed.
 */
const PACE_DIR = join(ROOT, 'out', 'pace');
const HOUR_MS = 3600_000;

export class PaceBook {
  private readonly own: Record<string, number[]> = {};
  private readonly file = join(PACE_DIR, `${process.pid}.json`);

  /** Every runner's pages on this shop in the last hour (ms epoch). */
  pages(site: string, now = Date.now()): number[] {
    const times: number[] = [];
    let names: string[] = [];
    try {
      names = readdirSync(PACE_DIR).filter((n) => n.endsWith('.json'));
    } catch {
      return this.recent(this.own[site] ?? [], now);
    }
    for (const name of names) {
      const path = join(PACE_DIR, name);
      try {
        const book = JSON.parse(readFileSync(path, 'utf8')) as Record<string, number[]>;
        const all = Object.values(book).flat();
        if (path !== this.file && all.every((t) => t < now - HOUR_MS))
          rmSync(path, { force: true });
        else times.push(...this.recent(book[site] ?? [], now));
      } catch {
        // a file the other runner is writing this moment: its pages count on the next look
      }
    }
    return times;
  }

  /** This runner asked the shop for a page now. */
  asked(site: string, now = Date.now()): void {
    this.own[site] = [...this.recent(this.own[site] ?? [], now), now];
    try {
      mkdirSync(PACE_DIR, { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.own));
    } catch {
      // this runner still keeps its own count
    }
  }

  private recent(times: number[], now: number): number[] {
    return times.filter((t) => t > now - HOUR_MS);
  }
}
