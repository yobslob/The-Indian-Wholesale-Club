import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { PRODUCT_TYPES } from '@repo/shared/domain';
import { checkRewrite } from '@repo/shared/sourcing/describe';

import { allWork, itemDir, readItem, writeDecision, type Work } from './items';
import { log } from './log';
import { page, type View } from './review-page';

/**
 * `review`: the new words beside the shop's on this machine only (http://127.0.0.1:4319, nothing online; the photo
 * redo has 4317 and 4318). Each listing: Approve, Reject (made again by the next `make`), or Edit (the founder's own
 * words, checked the same way; a price, link, shop or emoji is refused). "Approve all passed" approves every listing
 * of the view whose checks passed and that is still waiting. `publish` then sends what was chosen.
 */
const PORT = 4319;
const PER_PAGE = 30;

/** Written, not decided, not live: what "Approve all passed" may approve. */
export const waiting = (w: Work): boolean =>
  !!w.result?.words && !w.decision && !w.item.published && !w.item.stale;

const VIEWS: Record<View, (w: Work) => boolean> = {
  waiting: (w) => waiting(w) && w.result!.status === 'made',
  flagged: (w) => waiting(w) && w.result!.status !== 'made',
  approved: (w) => !!w.decision?.ok && !w.item.published,
  rejected: (w) => w.decision?.ok === false,
  live: (w) => !!w.item.published,
};

const body = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve) => {
    let text = '';
    req.on('data', (c: Buffer) => (text += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(text));
      } catch {
        resolve(null);
      }
    });
  });

const json = (res: ServerResponse, status: number, data: unknown): void =>
  void res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data));

export function review(out: string): Promise<void> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
    const type = PRODUCT_TYPES.find((t) => t === url.searchParams.get('type')) ?? null;
    if (req.method === 'POST' && url.pathname === '/decide') {
      void body(req).then((b) => {
        const d = b as {
          id?: string;
          type?: string;
          ok?: boolean;
          summary?: string;
          description?: string;
        } | null;
        const t = PRODUCT_TYPES.find((x) => x === d?.type);
        if (!d || !t || !/^[0-9a-f-]{36}$/.test(d.id ?? ''))
          return json(res, 400, { error: 'bad request' });
        const dir = itemDir(out, t, d.id!);
        const item = readItem(dir);
        if (!item) return json(res, 404, { error: 'not in the work folder' });
        if (typeof d.summary === 'string' && typeof d.description === 'string') {
          const words = {
            summary: d.summary.trim(),
            description: d.description.replace(/\r\n/g, '\n').trim(),
          };
          const check = checkRewrite(item, words);
          if (check.hard.length) return json(res, 422, { failures: check.hard });
          writeDecision(dir, { ok: true, words });
          return json(res, 200, { failures: check.failures });
        }
        writeDecision(dir, { ok: d.ok === true });
        return json(res, 200, { failures: [] });
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/approve-all') {
      const todo = allWork(out, type).filter(VIEWS.waiting);
      for (const w of todo) writeDecision(w.dir, { ok: true });
      log(`review: ${todo.length} listings approved at once`);
      return json(res, 200, { approved: todo.length });
    }
    const view =
      (Object.keys(VIEWS) as View[]).find((v) => v === url.searchParams.get('view')) ?? 'waiting';
    const all = allWork(out, type);
    const counts = Object.fromEntries(
      (Object.keys(VIEWS) as View[]).map((v) => [v, all.filter(VIEWS[v]).length]),
    ) as Record<View, number>;
    const shown = all.filter(VIEWS[view]);
    const at = Math.max(0, Number(url.searchParams.get('page')) || 0);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page({
        type,
        view,
        counts,
        works: shown.slice(at * PER_PAGE, (at + 1) * PER_PAGE),
        page: at,
        pages: Math.ceil(shown.length / PER_PAGE),
      }),
    );
  });
  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () =>
      log(`review: http://127.0.0.1:${PORT} (Ctrl+C to stop)`),
    );
    server.on('close', resolve);
  });
}
