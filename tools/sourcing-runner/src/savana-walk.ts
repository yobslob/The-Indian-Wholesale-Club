import {
  SAVANA_LIST_API,
  savanaHasNext,
  savanaIds,
  savanaListBody,
  savanaListOffers,
  type Offer,
} from '@repo/shared/sourcing/auto';

import { open, type Lane } from './lanes';

/**
 * D-171: Savana's activity pages as the runner has walked them this run (each page 20 offers, in the shop's order).
 * Its list answer leaves out the pieces the request names as seen, so page n needs pages 1 to n-1 first; the walk is
 * kept so the next target of the same activity starts where the last stopped. One walk per activity at a time.
 */
const walks = new Map<string, { pages: Offer[][]; seen: number[]; done: boolean; turn: Promise<unknown> }>();

export async function savanaWalk(lane: Lane, activity: string, upTo: number): Promise<Offer[][]> {
  const walk = walks.get(activity) ?? { pages: [], seen: [], done: false, turn: Promise.resolve() };
  walks.set(activity, walk);
  const next = walk.turn.then(async () => {
    while (!walk.done && walk.pages.length < upTo) {
      const n = walk.pages.length + 1;
      const json = await lane.run(async (page) => {
        if (!page.url().includes('savana.com')) await open(page, 'https://www.savana.com/');
        return page.evaluate(
          async ({ api, body }) => {
            const res = await fetch(api, {
              method: 'POST',
              headers: {
                'content-type': 'application/json;charset=utf-8',
                'country-language': 'en-IN',
                'x-source': 'pc',
                'x-platform': 'pc',
                client_type: 'pc',
              },
              body: JSON.stringify(body),
            });
            return res.ok ? ((await res.json()) as unknown) : null;
          },
          { api: SAVANA_LIST_API, body: savanaListBody(activity, n, walk.seen) },
        );
      });
      if (json === null) throw new Error('the results page did not load');
      const ids = savanaIds(json).filter((id) => !walk.seen.includes(id));
      walk.seen.push(...ids);
      walk.pages.push(savanaListOffers(json));
      if (!ids.length || !savanaHasNext(json)) walk.done = true;
    }
    return walk.pages;
  });
  walk.turn = next.catch(() => undefined);
  return next;
}
