import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { followMetroHost } from '../lib/local-host';

describe('local addresses follow the computer Metro runs on (development)', () => {
  it('swaps an old LAN address or localhost for the current one, keeping port and path', () => {
    assert.equal(followMetroHost('http://192.168.1.10:54321', '10.153.78.5:8081'), 'http://10.153.78.5:54321');
    assert.equal(followMetroHost('http://localhost:3000/api', '10.153.78.5:8081'), 'http://10.153.78.5:3000/api');
    assert.equal(followMetroHost('http://172.20.0.4:54321', '192.168.0.7:8081'), 'http://192.168.0.7:54321');
  });

  it('leaves hosted and public addresses alone', () => {
    assert.equal(followMetroHost('https://abc.supabase.co', '10.153.78.5:8081'), 'https://abc.supabase.co');
    assert.equal(followMetroHost('http://172.32.0.1:3000', '10.153.78.5:8081'), 'http://172.32.0.1:3000');
  });

  it('changes nothing without a LAN Metro address (web preview, tunnel, no Metro)', () => {
    assert.equal(followMetroHost('http://192.168.1.10:54321', undefined), 'http://192.168.1.10:54321');
    assert.equal(followMetroHost('http://192.168.1.10:54321', 'abc.exp.direct:80'), 'http://192.168.1.10:54321');
    assert.equal(followMetroHost(undefined, '10.153.78.5:8081'), undefined);
  });
});
