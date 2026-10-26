/**
 * After `check.mjs db` resets the local database: forget the website's cached store reads (Next's data cache in
 * apps/web/.next/cache/fetch-cache). They survive a rebuild, and after a reset they describe rows that no longer
 * exist: a product page built from them names a variant id the reset replaced, so its live stock never matches and
 * the piece reads "Sold out" while the database has five. Local only; production databases are never reset.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
rmSync(path.join(root, 'apps/web/.next/cache/fetch-cache'), { recursive: true, force: true });
console.log('Cleared the website’s cached store reads (apps/web/.next/cache/fetch-cache).');
