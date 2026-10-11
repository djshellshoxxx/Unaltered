import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { createPolicy } = require('../../../desktop/policy.cjs') as {
  createPolicy: (hosts: string[], root: string) => {
    isAllowedRequest: (u: string) => boolean;
    resolveAppPath: (u: string) => string | null;
  };
};

const root = path.resolve('/srv/app/web');
const p = createPolicy(['mempool.space', 'alice.btc.calendar.opentimestamps.org'], root);

describe('desktop request policy', () => {
  test('allows app origin, blob and allowlisted https hosts', () => {
    expect(p.isAllowedRequest('app://unaltered/main.js')).toBe(true);
    expect(p.isAllowedRequest('blob:app://unaltered/1234')).toBe(true);
    expect(p.isAllowedRequest('https://mempool.space/api/block-height/1')).toBe(true);
  });

  test('refuses everything else', () => {
    for (const u of [
      'http://mempool.space/api',
      'https://mempool.space:8443/api',
      'https://user@mempool.space/api',
      'https://evil.mempool.space.example/api',
      'https://example.com/',
      'file:///etc/passwd',
      'app://other/index.html',
      'wss://mempool.space/',
      'not a url',
    ]) expect(p.isAllowedRequest(u), u).toBe(false);
  });

  test('maps app paths inside the web root only', () => {
    expect(p.resolveAppPath('app://unaltered/')).toBe(path.join(root, 'index.html'));
    expect(p.resolveAppPath('app://unaltered/main.js')).toBe(path.join(root, 'main.js'));
    expect(p.resolveAppPath('app://unaltered/%2e%2e/%2e%2e/secret')).toBe(path.join(root, 'secret'));
    expect(p.resolveAppPath('app://unaltered/..%2f..%2fsecret')).toBeNull();
    expect(p.resolveAppPath('app://unaltered/a%00b')).toBeNull();
    expect(p.resolveAppPath('app://unaltered/%E0%A4%A')).toBeNull();
    expect(p.resolveAppPath('app://other/index.html')).toBeNull();
  });
});
