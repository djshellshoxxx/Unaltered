import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALLOWED_HOSTS, ENDPOINTS } from '../../src/core/net/allowlist';
import { netFetch } from '../../src/core/net/fetch';
import { bin, routerFetch, text } from '../helpers/chain';

describe('core/net (SPEC 9)', () => {
  const ok = routerFetch(() => text('hi'));

  it('blocks non-allowlisted hosts, http, credentials and odd ports', async () => {
    await expect(netFetch('https://evil.example/x', {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
    await expect(netFetch('http://mempool.space/x', {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
    await expect(netFetch(`https://user:secret${'@'}mempool.space/x`, {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
    await expect(netFetch('https://mempool.space:8443/x', {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
    await expect(netFetch('https://mempool.space.evil.example/x', {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
    await expect(netFetch('not a url', {}, { fetchImpl: ok })).rejects.toMatchObject({ code: 'NET_BLOCKED' });
  });

  it('sends no credentials/referrer/cache and never follows redirects', async () => {
    let init: RequestInit | undefined;
    const f = (async (_u: unknown, i: RequestInit) => ((init = i), text('x'))) as typeof fetch;
    await netFetch('https://mempool.space/a', { method: 'POST', body: Uint8Array.of(1) }, { fetchImpl: f });
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', method: 'POST' });
  });

  it('caps response size by content-length and by streamed bytes', async () => {
    const big = routerFetch(() => bin(new Uint8Array(300_000)));
    await expect(netFetch('https://mempool.space/a', {}, { fetchImpl: big })).rejects.toMatchObject({ code: 'NET_TOO_LARGE' });
    const declared = routerFetch(() => new Response('x', { headers: { 'content-length': '999999' } }));
    await expect(netFetch('https://mempool.space/a', {}, { fetchImpl: declared })).rejects.toMatchObject({ code: 'NET_TOO_LARGE' });
  });

  it('times out and supports abort', async () => {
    const slow = ((_u: unknown, i: RequestInit) => new Promise((_, rej) => i.signal!.addEventListener('abort', () => rej(new Error('a'))))) as typeof fetch;
    await expect(netFetch('https://mempool.space/a', {}, { fetchImpl: slow, timeoutMs: 20 })).rejects.toMatchObject({ code: 'NET_TIMEOUT' });
    const ac = new AbortController();
    const p = netFetch('https://mempool.space/a', { signal: ac.signal }, { fetchImpl: slow });
    ac.abort();
    await expect(p).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('allowlist matches the five documented hosts', () => {
    expect([...ALLOWED_HOSTS].sort()).toEqual(['alice.btc.calendar.opentimestamps.org', 'blockstream.info', 'bob.btc.calendar.opentimestamps.org', 'finney.calendar.eternitywall.com', 'mempool.space']);
    expect(ENDPOINTS.filter((e) => e.role === 'calendar')).toHaveLength(3);
  });
});

describe('architecture guards', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  const src = walk('src').filter((f) => /\.(ts|html|css)$/.test(f));

  it('only core/net calls fetch (NET-2)', () => {
    const offenders = src.filter((f) => !f.includes('core/net/') && /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no eval, innerHTML, document.write, Math.random, console, inline handlers (SR-4, OPSEC 4)', () => {
    const bad = /\beval\s*\(|new Function\s*\(|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|Math\.random|console\.|\son[a-z]+\s*=\s*["']/;
    const offenders = src.filter((f) => {
      const t = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      return bad.test(t.replace(/\.onmessage|\.onerror|\.onclick|\.onchange|\.oninput|\.onload|\.ondrop|\.ondragover|\.ondragleave|ctx\.onmessage/g, ''));
    });
    expect(offenders).toEqual([]);
  });

  it('no third-party origins are referenced outside the allowlist (SR-2)', () => {
    const urls = src.flatMap((f) => (readFileSync(f, 'utf8').match(/https?:\/\/[^\s'"`)<>]+/g) ?? []).map((u) => [f, u] as const));
    const allowedPrefixes = ['http://ns.adobe.com/', 'https://github.com/', 'https://opentimestamps.org', 'https://pypi.org/', 'https://bitcoin.org/', 'https://docs.github.com', 'http://localhost', 'https://${', 'https://x', 'https://evil.example'];
    const bad = urls.filter(([, u]) => !allowedPrefixes.some((p) => u.startsWith(p)) && ![...ALLOWED_HOSTS].some((h) => u.startsWith(`https://${h}`)));
    expect(bad).toEqual([]);
  });
});
