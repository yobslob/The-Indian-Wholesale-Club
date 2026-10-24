'use client';

import { create } from 'zustand';

/**
 * Saved pieces on this page (D-140, plan F6): every heart reads one small store, so a page asks the database once
 * (a signed-in visitor's saved ids, their own rows under RLS) instead of once per card. A tap changes the store at once
 * and the database follows a moment later (the last state of quick taps wins); a refusal puts the heart back and says
 * so. Signed out, saves stay on this device and join the account after sign-in. Static pages stay static: all of this
 * runs in the browser, after the page.
 */

const DEVICE_KEY = 'iwc-saved';
const SYNC_MS = 350;

function readDevice(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}
function writeDevice(ids: string[]): void {
  try {
    if (ids.length) localStorage.setItem(DEVICE_KEY, JSON.stringify(ids.slice(0, 200)));
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    // storage blocked: the save lasts for this page only
  }
}

interface SavedState {
  ids: Set<string>;
  /** null until the session was checked. */
  userId: string | null | undefined;
  /** The product whose save failed (its heart shows a short note). */
  failed: string | null;
  /** A signed-out save just happened: suggest signing in, once, for a few seconds. */
  deviceHint: boolean;
  hinted: boolean;
  load: () => void;
  toggle: (productId: string) => void;
}

type Account = typeof import('@repo/db/account');
let loading: Promise<void> | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const synced = new Map<string, boolean>();

/**
 * Whether the browser holds a Supabase session cookie (`sb-<project>-auth-token`, in chunks `.0`, `.1` when long; not
 * HttpOnly, @supabase/ssr). Without one the visitor is signed out, so Supabase's client (about 70 KB of script, which
 * every store page downloaded and ran after loading just to learn that) is never fetched for them.
 */
function mayHaveSession(): boolean {
  try {
    return /(?:^|;\s*)sb-[^=;]+-auth-token(?:\.\d+)?=/.test(document.cookie);
  } catch {
    return true;
  }
}

async function deps(): Promise<{ client: ReturnType<typeof import('@/lib/supabase/browser')['browserClient']>; account: Account }> {
  const [{ browserClient }, account] = await Promise.all([import('@/lib/supabase/browser'), import('@repo/db/account')]);
  return { client: browserClient(), account };
}

export const useSaved = create<SavedState>()((set, get) => ({
  ids: new Set(),
  userId: undefined,
  failed: null,
  deviceHint: false,
  hinted: false,
  load: () => {
    loading ??= (async () => {
      const device = readDevice();
      set({ ids: new Set(device) });
      if (!mayHaveSession()) return set({ userId: null });
      const { client, account } = await deps();
      const { data } = await client.auth.getSession();
      const userId = data.session?.user.id ?? null;
      if (!userId) return set({ userId: null });
      // saves made while signed out join the account now
      for (const id of device) await account.saveProduct(client, userId, id).catch(() => undefined);
      writeDevice([]);
      const ids = await account.listSavedProductIds(client).catch(() => [...device]);
      for (const id of ids) synced.set(id, true);
      set({ userId, ids: new Set([...ids, ...[...get().ids].filter((id) => !synced.has(id))]) });
    })();
  },
  toggle: (productId) => {
    const ids = new Set(get().ids);
    const on = !ids.has(productId);
    if (on) ids.add(productId);
    else ids.delete(productId);
    set({ ids, failed: null });
    // The heart answers at once; where the save goes waits for the session check. A tap while it is still running
    // (a signed-in customer's first second on a page) was kept on the device and then lost when the check cleared the
    // device's list (found 2026-10-24: saved.spec.ts).
    void (loading ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => keep(productId, on));
  },
}));

/** Where a tap's save goes once the session is known: this device when signed out, else the account a moment later. */
function keep(productId: string, on: boolean): void {
  const { getState: get, setState: set } = useSaved;
  const userId = get().userId;
  if (!userId) {
    writeDevice([...get().ids]);
    if (on && !get().hinted) {
      set({ deviceHint: true, hinted: true });
      setTimeout(() => set({ deviceHint: false }), 6000);
    }
    return;
  }
  clearTimeout(timers.get(productId));
  timers.set(
    productId,
    setTimeout(() => {
      timers.delete(productId);
      const want = get().ids.has(productId);
      if (synced.get(productId) === want) return;
      void (async () => {
        try {
          const { client, account } = await deps();
          if (want) await account.saveProduct(client, userId, productId);
          else await account.unsaveProduct(client, productId);
          synced.set(productId, want);
        } catch {
          // put the heart back as the database has it, and say so
          const back = new Set(get().ids);
          if (want) back.delete(productId);
          else back.add(productId);
          set({ ids: back, failed: productId });
        }
      })();
    }, SYNC_MS),
  );
}
