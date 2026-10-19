import 'server-only';

import { listPhotosWithoutCopies, setPhotoPath, type PhotoWithoutCopies } from '@repo/db/admin';
import { canHaveCopies } from '@repo/shared/domain';

import { errorMessage, logger } from '@/lib/logger';
import { withCopies } from '@/lib/photo-copies';

import type { IwcClient } from '@repo/db';

/** Copies for one recorded photo, then its row points at them. */
async function copyRecorded(client: IwcClient, photo: PhotoWithoutCopies): Promise<boolean> {
  const target = await withCopies(client, 'product-media', photo.path);
  if (target === photo.path) return false;
  await setPhotoPath(client, photo, target);
  return true;
}

let sweeping: Promise<number> | null = null;
let lastSweep = 0;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * Gives copies to photos stored without them (from the phone, the auto-sourcing runner, or before D-140), a few at a
 * time, with the admin's own session. Runs after an admin page is sent (layout `after()`), at most every 5 minutes per
 * server, so photos catch up without anyone running a script. Returns how many it did.
 */
export function sweepPhotoCopies(client: IwcClient, limit = 24): Promise<number> {
  if (sweeping || Date.now() - lastSweep < SWEEP_EVERY_MS) return sweeping ?? Promise.resolve(0);
  lastSweep = Date.now();
  sweeping = (async () => {
    let done = 0;
    try {
      const todo = (await listPhotosWithoutCopies(client, limit)).filter((p) => canHaveCopies(p.path)).slice(0, limit);
      for (let i = 0; i < todo.length; i += 4) {
        const results = await Promise.allSettled(todo.slice(i, i + 4).map((p) => copyRecorded(client, p)));
        done += results.filter((r) => r.status === 'fulfilled' && r.value).length;
      }
      if (done) logger.info('photo.copies_swept', { done });
    } catch (error) {
      logger.warn('photo.sweep_failed', { error: errorMessage(error) });
    } finally {
      sweeping = null;
    }
    return done;
  })();
  return sweeping;
}

/** Copies for the given recorded photos now (a listing's photos just uploaded from the phone). */
export async function copyPhotosNow(client: IwcClient, photos: PhotoWithoutCopies[]): Promise<number> {
  const results = await Promise.allSettled(photos.filter((p) => canHaveCopies(p.path)).map((p) => copyRecorded(client, p)));
  return results.filter((r) => r.status === 'fulfilled' && r.value).length;
}
