import { readFileSync, writeFileSync } from 'node:fs';
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

/** Rests the shop from now (longer if it rested lately) and returns the rest. */
export function restShop(site: string, now = new Date()): ShopRest {
  const all = readRests();
  const rest = nextRest(site, all[site], now);
  all[site] = rest;
  try {
    writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`);
  } catch {
    // this run still leaves the shop alone; the next one may ask it once more
  }
  return rest;
}
