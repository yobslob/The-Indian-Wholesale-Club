import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requestErrorAlert } from '../lib/request-error';

describe('requestErrorAlert (F-4)', () => {
  it('sends the route pattern, method, digest and release only', () => {
    const error = Object.assign(new Error('relation "orders" leaked priya@example.com'), { digest: '2345678901' });
    const alert = requestErrorAlert({
      error,
      method: 'POST',
      routePath: '/api/orders?email=priya@example.com',
      routeType: 'route',
      release: 'abcdef1234567890',
    });
    assert.equal(alert.key, 'request:route:/api/orders');
    assert.equal(alert.title, 'Server error on /api/orders');
    assert.deepEqual(alert.fields, {
      route: '/api/orders',
      method: 'POST',
      kind: 'route',
      digest: '2345678901',
      error: 'Error',
      release: 'abcdef1',
    });
    assert.ok(!JSON.stringify(alert).includes('priya'));
  });

  it('one key per route pattern, whatever the real path', () => {
    const a = requestErrorAlert({ error: 'x', method: 'GET', routePath: '/states/[region]/[product]', routeType: 'render', release: undefined });
    assert.equal(a.key, 'request:render:/states/[region]/[product]');
    assert.equal(a.fields.release, 'local');
    assert.equal(a.fields.digest, undefined);
  });

  it('keeps odd methods and long digests out', () => {
    const a = requestErrorAlert({
      error: { digest: 'x'.repeat(200) },
      method: 'GET /etc/passwd',
      routePath: '/',
      routeType: 'render',
      release: undefined,
    });
    assert.equal(a.fields.method, 'OTHER');
    assert.equal(a.fields.digest, undefined);
  });
});
