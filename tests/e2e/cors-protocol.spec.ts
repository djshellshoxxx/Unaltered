import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, test } from '@playwright/test';
import { browserRequest, probePendingCalendar } from '../../scripts/cors-calendar-check.mjs';
import { classifyReply, pendingRequests, RESEARCH_CALENDARS } from '../../scripts/cors-calendar-protocol';
import { concat, toHex } from '../../src/core/bytes';
import { serializeTree } from '../../src/core/ots/codec';

const origin = 'https://alice.btc.calendar.opentimestamps.org';
const submitted = new Uint8Array(32);

test('CORS qualification queries the pending node commitment rather than the submitted digest', () => {
  const arg = Uint8Array.of(7, 8);
  const commitment = concat(submitted, arg);
  const body = serializeTree({ msg: submitted, attestations: [], children: [{ op: { kind: 'append', arg },
    node: { msg: commitment, attestations: [{ kind: 'pending', uri: origin }], children: [] } }] });
  const targets = pendingRequests(body, submitted);
  expect(targets).toEqual([{ origin, commitmentHex: toHex(commitment) }]);
  expect(targets[0]?.commitmentHex).not.toBe(toHex(submitted));
});

test('CORS qualification rejects malformed or unapproved submission proofs', () => {
  expect(() => pendingRequests(Uint8Array.of(1), submitted)).toThrow();
  for (const uri of ['https://evil.invalid', 'http://alice.btc.calendar.opentimestamps.org', `${origin}/other`]) {
    const body = serializeTree({ msg: submitted, children: [], attestations: [{ kind: 'pending', uri }] });
    expect(() => pendingRequests(body, submitted)).toThrow('research policy');
  }
  const excessive = serializeTree({ msg: submitted, children: [], attestations:
    RESEARCH_CALENDARS.slice(0, 5).map((uri) => ({ kind: 'pending', uri })) });
  expect(() => pendingRequests(excessive, submitted)).toThrow('between one and four');
});

test('CORS qualification never treats HTTP200 or Bitcoin metadata as independent verification', () => {
  expect(classifyReply(200, Uint8Array.of(1), submitted)).toBe('INVALID_REPLY');
  const body = serializeTree({ msg: submitted, children: [], attestations: [{ kind: 'bitcoin', height: 123 }] });
  expect(classifyReply(200, body, submitted)).toBe('BITCOIN_DATA_UNVERIFIED');
  expect(classifyReply(404, new Uint8Array(), submitted)).toBe('READABLE_404');
});

const listen = async (server: Server): Promise<string> => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
};
const close = (server: Server): Promise<void> => new Promise((done) => server.close(() => done()));

test('the emitted-app-CSP calendar probe GETs the returned pending commitment, not its submitted root', async ({ page, context }) => {
  let expected = '';
  let original = '';
  const lookups: string[] = [];
  await context.route(`${origin}/**`, async (route) => {
    if (new URL(route.request().url()).pathname === '/digest') {
      const digest = new Uint8Array(route.request().postDataBuffer()!);
      original = toHex(digest);
      const arg = Uint8Array.of(42);
      const commitment = concat(digest, arg);
      expected = toHex(commitment);
      const body = serializeTree({ msg: digest, attestations: [], children: [{ op: { kind: 'append', arg },
        node: { msg: commitment, attestations: [{ kind: 'pending', uri: origin }], children: [] } }] });
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(body) });
    } else {
      lookups.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: 'Pending' });
    }
  });
  await page.goto('/index.html');
  const result = await probePendingCalendar(page, origin, [origin]);
  expect(expected).not.toBe(original);
  expect(lookups).toEqual([`/timestamp/${expected}`]);
  expect(result.pendingLookups).toMatchObject([{ status: 404, classification: 'READABLE_404' }]);
});

for (const invalid of ['malformed', 'outside app policy']) {
  test(`the emitted-app-CSP probe refuses ${invalid} POST proof before a pending GET`, async ({ page, context }) => {
    let gets = 0;
    await context.route('https://**/timestamp/**', async (route) => { gets++; await route.abort(); });
    await context.route(`${origin}/digest`, async (route) => {
      const digest = new Uint8Array(route.request().postDataBuffer()!);
      const body = invalid === 'malformed' ? Buffer.from('garbage') : Buffer.from(serializeTree({ msg: digest, children: [],
        attestations: [{ kind: 'pending', uri: 'https://a.pool.opentimestamps.org' }] }));
      await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body });
    });
    await page.goto('/index.html');
    const result = await probePendingCalendar(page, origin, [origin]);
    expect(result.protocolError).toBe('INVALID_OR_UNAPPROVED_SUBMISSION_PROOF');
    expect(result.pendingLookups).toEqual([]);
    expect(gets).toBe(0);
  });
}

test('real browser distinguishes readable404 from blocked404 and refuses redirects, oversized and stalled replies', async ({ page }) => {
  let redirected = 0;
  const site = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>Local CORS fixture</title>'));
  const calendar = createServer((req, res) => {
    if (req.url === '/blocked') { res.writeHead(404).end('Pending'); return; }
    const headers = { 'access-control-allow-origin': '*' };
    if (req.url === '/redirect') { res.writeHead(302, { ...headers, location: '/redirected' }).end(); return; }
    if (req.url === '/redirected') redirected++;
    if (req.url === '/large') { res.writeHead(200, headers).end(Buffer.alloc(4096)); return; }
    if (req.url === '/slow') {
      res.writeHead(200, headers); res.write('x');
      setTimeout(() => res.end('late'), 150);
      return;
    }
    res.writeHead(404, headers).end('Pending');
  });
  const siteOrigin = await listen(site);
  const calendarOrigin = await listen(calendar);
  try {
    await page.goto(siteOrigin);
    const readable = await page.evaluate(browserRequest, { url: `${calendarOrigin}/readable` });
    expect(readable.status).toBe(404);
    const blocked = await page.evaluate(browserRequest, { url: `${calendarOrigin}/blocked` });
    expect(blocked.status).toBeUndefined();
    expect(blocked.error).toBe('TypeError');
    const redirect = await page.evaluate(browserRequest, { url: `${calendarOrigin}/redirect` });
    expect(redirect.status).toBeUndefined();
    expect(redirect.error).toBe('TypeError');
    expect(redirected).toBe(0);
    const large = await page.evaluate(browserRequest, { url: `${calendarOrigin}/large`, cap: 8 });
    expect(large.status).toBeUndefined();
    expect(large.error).toBe('REPLY_LIMIT_OR_READ_ERROR');
    const slow = await page.evaluate(browserRequest, { url: `${calendarOrigin}/slow`, timeoutMs: 20 });
    expect(slow.status).toBeUndefined();
    expect(['AbortError', 'TimeoutError']).toContain(slow.error);
  } finally {
    await close(calendar);
    await close(site);
  }
});
