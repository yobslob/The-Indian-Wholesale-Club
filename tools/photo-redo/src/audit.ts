import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { log } from './log';

import type { Db } from './db';
import type { Store } from './store';

/**
 * `audit`: what fills the photo store. Every file is listed (one write per 1,000 keys) and summed by folder; a
 * listing photo's copies (`product-media/products/<id>/s/<name>.w640.avif` and `.w1200.avif`) that no listing shows
 * any more (a deleted listing or photo, a draft thrown away) are orphans. Only those, and only ones over a day old (a
 * photo is written before its row), are deleted, with `--delete`. out/audit.csv lists every orphan.
 */

const LISTING_COPY = /^product-media\/(products\/[^/]+\/s\/[^/]+)\.w\d+\.avif$/;
const DAY_MS = 24 * 3600_000;

const gb = (bytes: number): string => `${(bytes / 1e9).toFixed(2)} GB`;

export async function audit(out: string, db: Db, store: Store, remove: boolean): Promise<void> {
  const folders = new Map<string, { files: number; bytes: number }>();
  const rows = ['key,bytes,modified'];
  let files = 0;
  let bytes = 0;
  let orphans = 0;
  let orphanBytes = 0;
  for await (const page of store.list('')) {
    for (const f of page) {
      files += 1;
      bytes += f.size;
      const folder = f.key.split('/').slice(0, 2).join('/');
      const sum = folders.get(folder) ?? { files: 0, bytes: 0 };
      folders.set(folder, { files: sum.files + 1, bytes: sum.bytes + f.size });
    }
    const old = page.filter((f) => LISTING_COPY.test(f.key) && Date.now() - f.modified.getTime() > DAY_MS);
    const stemOf = (key: string): string => LISTING_COPY.exec(key)![1]!;
    const shown = await db.inUse([...new Set(old.map((f) => stemOf(f.key)))]);
    for (const f of old.filter((x) => !shown.has(stemOf(x.key)))) {
      orphans += 1;
      orphanBytes += f.size;
      rows.push(`${f.key},${f.size},${f.modified.toISOString()}`);
      if (remove) await store.delete(f.key);
    }
  }
  writeFileSync(join(out, 'audit.csv'), `${rows.join('\n')}\n`);
  for (const [folder, sum] of [...folders].sort((a, b) => b[1].bytes - a[1].bytes))
    log(`  ${folder}: ${sum.files} files, ${gb(sum.bytes)}`);
  log(
    `audit: ${files} files, ${gb(bytes)}; ${orphans} listing photo copies no listing shows, ${gb(orphanBytes)}` +
      (remove ? ', deleted' : ` (out/audit.csv; \`pnpm photos:redo audit --delete\` deletes them)`),
  );
}
