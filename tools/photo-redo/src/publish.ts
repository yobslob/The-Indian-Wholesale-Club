import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { storeKeys, type ProductType } from '@repo/shared/domain';

import { allWork, modeOf, writeItem, type Work } from './items';
import { errorText, log } from './log';

import type { Db } from './db';
import type { Store } from './store';

/** A replaced photo's copies are deleted this long after the switch: store pages are cached for 5 minutes. */
const SWEEP_AFTER_MS = 10 * 60_000;

const stem = (path: string): string => path.replace(/\.[A-Za-z0-9]+$/, '');

/** Ready to go live: approved on the review page, or with --auto passed by the automatic checks and not rejected. */
const approved = (w: Work, auto: boolean): boolean =>
  w.result?.status === 'made' && (w.decision ? w.decision.ok : auto && w.result.pass);

/** Removed on the review page (D-164): taken off the listing. */
const removed = (w: Work): boolean => w.decision?.remove === true;

/** Kept as it is: nothing to change, or a portrait the founder chose to keep. */
const keeps = (w: Work): boolean =>
  (w.result?.status === 'none' && w.decision?.ok !== false) ||
  (w.result?.status === 'failed' && w.result.mode === 'crop' && !!w.decision && !w.decision.remove);

/** Settled: goes live, is removed, or is marked as looked at. */
const settled = (w: Work, auto: boolean): boolean => removed(w) || approved(w, auto) || keeps(w);

/**
 * `publish`: every approved photo goes live. Its two copies are written under a new path, the listing pointed at it
 * (only if the photo is still the one fetched; else the copies are deleted and the photo left alone), and the old
 * copies deleted by the sweep 10 minutes later. Clothing goes a whole listing at a time, so a listing never shows two
 * different faces: until each of its photos is settled, none of them goes.
 */
export async function publish(out: string, db: Db, store: Store, type: ProductType, auto: boolean): Promise<void> {
  const work = allWork(out, type).filter((w) => !w.item.published && !w.item.stale);
  const byListing = new Map<string, Work[]>();
  for (const w of work) byListing.set(w.item.product_id, [...(byListing.get(w.item.product_id) ?? []), w]);
  let live = 0;
  let kept = 0;
  let gone = 0;
  let waiting = 0;
  for (const photos of byListing.values()) {
    const ready = photos.filter((w) => settled(w, auto));
    if (type === 'clothing' && ready.length < photos.length) {
      waiting += photos.length;
      continue;
    }
    waiting += photos.length - ready.length;
    for (const w of ready) {
      try {
        if (removed(w)) gone += (await remove(db, w)) ? 1 : 0;
        else if (approved(w, auto)) live += (await goLive(db, store, w)) ? 1 : 0;
        else kept += (await keep(db, w)) ? 1 : 0;
      } catch (error) {
        log(`  ${w.item.name}: ${errorText(error)}`);
      }
    }
  }
  log(
    `${type}: ${live} new photos live, ${gone} removed, ${kept} marked as nothing to change, ${waiting} waiting for ` +
      `review or work`,
  );
  await sweep(out, db, store, type);
}

async function goLive(db: Db, store: Store, w: Work): Promise<boolean> {
  const { item } = w;
  const path = `products/${item.product_id}/s/${randomUUID()}.jpg`;
  await store.putCopies(path, readFileSync(join(w.dir, 'after.png')));
  const mode = modeOf(w);
  // a home scene goes first with the plain photo kept second; everything else replaces its photo
  const scene = mode === 'scene' && item.type === 'home';
  const redo = mode === 'fresh' ? 'fresh' : mode === 'scene' ? (item.type === 'home' ? 'scene' : 'food') : 'face';
  const ok = scene
    ? (await db.scene(item.media_id, item.path, path, item.alt || item.name)) !== null
    : await db.set(item.media_id, item.path, path, redo === 'scene' ? 'food' : redo);
  if (!ok) {
    await Promise.all(storeKeys('product-media', path).map((k) => store.delete(k)));
    writeItem(w.dir, { ...item, stale: true });
    log(`  ${item.name}: the photo changed since it was fetched; left alone`);
    return false;
  }
  writeItem(w.dir, {
    ...item,
    published: {
      path,
      at: new Date().toISOString(),
      redo,
      old_path: scene ? null : item.path,
    },
  });
  return true;
}

async function keep(db: Db, w: Work): Promise<boolean> {
  const ok = await db.set(w.item.media_id, w.item.path, null, 'kept');
  writeItem(w.dir, ok ? { ...w.item, published: { path: null, at: new Date().toISOString(), redo: 'kept', old_path: null } }
                      : { ...w.item, stale: true });
  return ok;
}

async function remove(db: Db, w: Work): Promise<boolean> {
  const ok = await db.drop(w.item.media_id, w.item.path);
  const at = new Date().toISOString();
  writeItem(w.dir, ok ? { ...w.item, published: { path: null, at, redo: 'removed', old_path: w.item.path } }
                      : { ...w.item, stale: true });
  if (!ok) log(`  ${w.item.name}: not removed (its only photo, or changed since it was fetched)`);
  return ok;
}

/** Deletes the copies of photos replaced over 10 minutes ago, once no listing shows them (checked again here). */
export async function sweep(out: string, db: Db, store: Store, type: ProductType): Promise<number> {
  const due = allWork(out, type).filter(
    (w) =>
      w.item.published?.old_path &&
      !w.item.published.swept &&
      Date.now() - new Date(w.item.published.at).getTime() > SWEEP_AFTER_MS,
  );
  if (!due.length) {
    log(`${type}: no replaced photos due for deleting`);
    return 0;
  }
  const shown = await db.inUse(due.map((w) => stem(w.item.published!.old_path!)));
  let deleted = 0;
  for (const w of due) {
    const old = w.item.published!.old_path!;
    try {
      if (!shown.has(stem(old))) {
        await Promise.all(storeKeys('product-media', old).map((k) => store.delete(k)));
        deleted += 1;
      }
      writeItem(w.dir, { ...w.item, published: { ...w.item.published!, swept: true } });
    } catch (error) {
      log(`  ${w.item.name}: old copies not deleted: ${errorText(error)}`);
    }
  }
  log(`${type}: ${deleted} replaced photos' copies deleted`);
  return deleted;
}
