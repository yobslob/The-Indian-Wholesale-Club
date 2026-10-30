import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { ROOT } from './env';
import { errorText, log } from './log';

import type { Db } from './db';
import type { ProductType } from '@repo/shared/domain';

/**
 * D-168: a new listing's photos are made again before they are uploaded, by the photo redo service on this machine
 * (tools/photo-worker/redo_serve.py, the GPU's work as redo.py does it), so they never wait for `pnpm photos:redo`.
 * Started here when it isn't running and the photo worker's Python is installed; without it (another PC, no GPU,
 * IWC_SOURCING_REDO=off) photos go up as they are and the laptop's redo does them later.
 */

const URL_BASE = process.env.IWC_REDO_URL ?? 'http://127.0.0.1:4318';
const WORKER = join(ROOT, '..', 'photo-worker');
const PYTHON = join(WORKER, '.venv', 'Scripts', 'python.exe');
const START_MS = 120_000;
const LISTING_MS = 10 * 60_000;

const answerSchema = z.object({
  photos: z.array(
    z.object({
      status: z.enum(['made', 'failed']),
      mode: z.enum(['face', 'crop', 'fresh']).nullable(),
      pass: z.boolean(),
      note: z.string(),
      image: z.string().nullable(),
    }),
  ),
  house_model: z.string().nullable(),
});

/** What goes up for one photo: the new picture and its mark, or the shop's as it is (no mark: the redo takes it later). */
export interface Redone {
  body: Buffer;
  type: string;
  redo?: 'face' | 'fresh';
}

const healthy = async (): Promise<boolean> => {
  try {
    return (await fetch(`${URL_BASE}/health`, { signal: AbortSignal.timeout(3_000) })).ok;
  } catch {
    return false;
  }
};

export class Redo {
  private off = false;

  private constructor() {}

  /** The service, started if need be; null when photos go up as they are this run. */
  static async start(db: Db): Promise<Redo | null> {
    if (process.env.IWC_SOURCING_REDO === 'off') return null;
    try {
      // the database must keep the marks first, or every photo made here would be made again by the redo
      await db.wears('00000000-0000-4000-8000-000000000000');
    } catch {
      log('photo redo: run the Deploy workflow (migration 20261103100000) first; new photos go up as they are');
      return null;
    }
    if (await healthy()) return new Redo();
    if (!existsSync(PYTHON) || !existsSync(join(WORKER, 'redo_serve.py'))) {
      log('photo redo: no photo worker on this PC (tools/photo-worker/.venv); new photos go up as they are');
      return null;
    }
    // its own window-less process: it outlives this run (another runner may use it) and ends after 30 idle minutes
    spawn(PYTHON, ['redo_serve.py'], { cwd: WORKER, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    const until = Date.now() + START_MS;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 2_000));
      if (await healthy()) {
        log('photo redo: service started (tools/photo-worker/serve.log)');
        return new Redo();
      }
    }
    log('photo redo: the service did not start (tools/photo-worker/serve.log); new photos go up as they are');
    return null;
  }

  /** The database kept no marks (the migration of D-168 is not deployed): stop, so no photo is made twice. */
  stop(why: string): void {
    if (!this.off) log(`photo redo: stopped for this run: ${why}`);
    this.off = true;
  }

  /**
   * A listing's photos, made again. Food and home: each photo the refresh made, the rest as they are. Clothing goes
   * whole (D-164): a listing never shows a house model beside a shop's face, so if any photo needs the founder (a
   * portrait) or failed, every photo goes up as it is and the review page has the listing.
   */
  async listing(type: ProductType, wears: string | null, photos: { body: Buffer; type: string }[]): Promise<Redone[]> {
    if (this.off || !photos.length) return photos;
    let answer: z.infer<typeof answerSchema>;
    try {
      const res = await fetch(`${URL_BASE}/listing`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, wears, photos: photos.map((p) => p.body.toString('base64')) }),
        signal: AbortSignal.timeout(LISTING_MS),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      answer = answerSchema.parse(await res.json());
      if (answer.photos.length !== photos.length) throw new Error('an answer for another number of photos');
    } catch (error) {
      log(`  photo redo: ${errorText(error)}; the photos go up as they are`);
      return photos;
    }
    const made = answer.photos.map((p) => p.status === 'made' && p.image !== null);
    if (type === 'clothing' && !made.every(Boolean)) {
      log(`  photo redo: ${answer.photos.filter((p) => p.status !== 'made').length} photo(s) for the review page; the listing waits for it`);
      return photos;
    }
    log(`  photo redo: ${answer.photos.map((p) => (p.status === 'made' ? p.mode : 'as it is')).join(', ')}`);
    return photos.map((photo, i) => {
      const p = answer.photos[i]!;
      if (!made[i]) return photo;
      // the redo's own marks (publish.ts): a face or a cut is `face`, a reframe or the refresh `fresh`
      return { body: Buffer.from(p.image!, 'base64'), type: 'image/jpeg', redo: p.mode === 'fresh' ? 'fresh' : 'face' };
    });
  }
}
