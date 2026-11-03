import type { BrowsePage } from '@repo/db/store';

const AGAIN_MS = 1200;

/**
 * One page of cards from /api/browse, asked once more after a moment when the first answer fails (D-181: a fresh read
 * can pass the database's 3 s limit while others run, and the next one usually answers). A second failure is the
 * caller's "did not load".
 */
export async function fetchBrowse(url: string): Promise<BrowsePage> {
  const once = async (): Promise<BrowsePage> => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as BrowsePage;
  };
  try {
    return await once();
  } catch {
    await new Promise((done) => setTimeout(done, AGAIN_MS));
    return once();
  }
}
