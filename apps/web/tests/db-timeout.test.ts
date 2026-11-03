import assert from 'node:assert/strict';
import { createServer, type ServerResponse } from 'node:http';
import { describe, it } from 'node:test';

import { createClient } from '@supabase/supabase-js';

import { DbTimeoutError, isDbBusy, withTimeLimit } from '../lib/supabase/timeout';

import type { AddressInfo } from 'node:net';

/** A fetch that answers only when its signal fires (a database that never answers), or after `ms`. */
function slowFetch(ms = Number.POSITIVE_INFINITY) {
  const seen: { signal?: AbortSignal | null; url?: string } = {};
  const fetchLike = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    seen.signal = init?.signal;
    seen.url = String(input);
    return new Promise((resolve, reject) => {
      const timer = Number.isFinite(ms) ? setTimeout(() => resolve(new Response('ok')), ms) : undefined;
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(init.signal?.reason);
      });
    });
  };
  return { fetchLike, seen };
}

describe('the time limit on server Supabase calls (F-0)', () => {
  it('fails a call that does not answer in time with a clear timeout error', async () => {
    const { fetchLike } = slowFetch();
    const limited = withTimeLimit(fetchLike, { db: 30, storage: 1000 });
    const started = Date.now();
    await assert.rejects(limited('http://db.test/rest/v1/store_categories'), (error: unknown) => {
      assert.ok(error instanceof DbTimeoutError);
      assert.equal(error.name, 'TimeoutError');
      assert.match(error.message, /timed out after 30 ms/);
      return true;
    });
    assert.ok(Date.now() - started < 500, 'gave up at the limit, not later');
  });

  it('lets a call that answers in time through', async () => {
    const { fetchLike } = slowFetch(5);
    const res = await withTimeLimit(fetchLike, { db: 200, storage: 200 })('http://db.test/rest/v1/x');
    assert.equal(await res.text(), 'ok');
  });

  it('gives storage calls their own, longer limit', async () => {
    const { fetchLike } = slowFetch(60);
    const limited = withTimeLimit(fetchLike, { db: 20, storage: 500 });
    const res = await limited('http://db.test/storage/v1/object/photos/a.avif');
    assert.equal(res.status, 200);
    await assert.rejects(limited('http://db.test/rest/v1/x'), DbTimeoutError);
  });

  it("still stops at the caller's own signal, and says it was the caller's", async () => {
    const { fetchLike } = slowFetch();
    const caller = new AbortController();
    const call = withTimeLimit(fetchLike, { db: 1000, storage: 1000 })('http://db.test/rest/v1/x', {
      signal: caller.signal,
    });
    caller.abort();
    await assert.rejects(call, (error: unknown) => !(error instanceof DbTimeoutError));
  });

  it('passes the rest of the request through unchanged', async () => {
    const { fetchLike, seen } = slowFetch(1);
    await withTimeLimit(fetchLike, { db: 100, storage: 100 })(new URL('http://db.test/rest/v1/rpc/f'), {
      method: 'POST',
    });
    assert.equal(seen.url, 'http://db.test/rest/v1/rpc/f');
    assert.ok(seen.signal, 'a signal is always attached');
  });
});

describe('a real Supabase client against a database that never answers', () => {
  it('gets an error back at the limit, once (no retries), that reads as busy', async () => {
    const hung: ServerResponse[] = [];
    let requests = 0;
    const server = createServer((_req, res) => {
      requests += 1;
      hung.push(res); // never answered
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const client = createClient(`http://127.0.0.1:${port}`, 'anon-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: withTimeLimit(undefined, { db: 150, storage: 150 }) },
        db: { retry: false },
      });
      const started = Date.now();
      const { data, error } = await client.from('store_categories').select('id').limit(1);
      assert.equal(data, null);
      assert.ok(error, 'an error, not a hang');
      assert.match(error.message, /^TimeoutError/);
      assert.equal(isDbBusy(error), true);
      assert.ok(Date.now() - started < 1000, `answered in ${Date.now() - started} ms`);
      assert.equal(requests, 1, 'asked once');
    } finally {
      for (const res of hung) res.destroy();
      server.close();
    }
  });
});

describe('recognising a busy database', () => {
  it('knows our timeout, an abort, and the error postgrest-js and @repo/db make from them', () => {
    assert.equal(isDbBusy(new DbTimeoutError(8000)), true);
    assert.equal(isDbBusy({ name: 'AbortError', message: 'aborted' }), true);
    assert.equal(isDbBusy({ message: 'TimeoutError: Database request timed out after 8000 ms', code: '' }), true);
    const dbError = Object.assign(new Error('TimeoutError: Database request timed out after 8000 ms'), {
      name: 'DbError',
      code: 'unknown',
    });
    assert.equal(isDbBusy(dbError), true);
  });

  it("knows the database's statement limit and PostgREST's connection errors", () => {
    assert.equal(isDbBusy({ code: '57014', message: 'canceling statement due to statement timeout' }), true);
    assert.equal(isDbBusy({ code: 'PGRST002', message: 'Could not query the database for the schema cache' }), true);
  });

  it('is not fooled by ordinary errors', () => {
    assert.equal(isDbBusy(new Error('insufficient_stock')), false);
    assert.equal(isDbBusy({ code: '23505', message: 'duplicate key' }), false);
    assert.equal(isDbBusy(null), false);
    assert.equal(isDbBusy('TimeoutError'), false);
  });
});
