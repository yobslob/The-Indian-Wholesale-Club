import 'server-only';

import { listPhotosWithoutCopies, setPhotoPath, type PhotoWithoutCopies } from '@repo/db/admin';
import { canHaveCopies } from '@repo/shared/domain';

import { errorMessage, logger } from '@/lib/logger';
import { removeSupabaseFiles, withCopies } from '@/lib/photo-copies';
import { photoStoreReady } from '@/lib/photo-store';

import type { IwcClient } from '@repo/db';

/** One recorded photo into the photo store: its copies, its row, then its Supabase files go. */
async function copyRecorded(client: IwcClient, photo: PhotoWithoutCopies): Promise<boolean> {
  const target = await withCopies(client, 'product-media', photo.path);
  if (target === photo.path) return false;
  await setPhotoPath(client, photo, target);
  await removeSupabaseFiles(client, 'product-media', [photo.path]);
  return true;
}

let sweeping: Promise<number> | null = null;
let lastSweep = 0;
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * Moves photos added in the last 3 days that are still in Supabase's storage (from the phone, or the runner without a
 * photo store) into the photo store, a few at a time, with the admin's own session. Runs after an admin page is sent
 * (layout `after()`), at most every 5 minutes per server. Older photos are `pnpm photos:copies`'s job (encoding on
 * Vercel costs its CPU allowance). Returns how many it did.
 */
export function sweepPhotoCopies(client: IwcClient, limit = 24): Promise<number> {
  if (!photoStoreReady() || sweeping || Date.now() - lastSweep < SWEEP_EVERY_MS) return sweeping ?? Promise.resolve(0);
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

/** The given recorded photos into the photo store now (a listing's photos just uploaded from the phone). */
export async function copyPhotosNow(client: IwcClient, photos: PhotoWithoutCopies[]): Promise<number> {
  const results = await Promise.allSettled(photos.filter((p) => canHaveCopies(p.path)).map((p) => copyRecorded(client, p)));
  return results.filter((r) => r.status === 'fulfilled' && r.value).length;
}
