// R1 liveness canary (ADR-014): an unreadable pending lookup is followed by one fixed public lookup per calendar whose
// completed reply the recorded evidence shows browsers can read. The canary only separates "reachable, probably still
// pending" from "unreachable or blocked"; it never changes the receipt or its status.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { concat, fromHex, toHex } from '../../src/core/bytes';
import { upgrade, type StampConfig } from '../../src/core/ots/calendar';
import { serializeProof, serializeTree } from '../../src/core/ots/codec';
import { LIVENESS_CANARIES, canaryFor } from '../../src/core/ots/liveness';
import type { TsNode } from '../../src/core/ots/types';
import { DEFAULT_CALENDARS } from '../../src/core/net/allowlist';
import { sha256 } from '@noble/hashes/sha2.js';

const CAL = [...DEFAULT_CALENDARS];
const digest = sha256(new TextEncoder().encode('liveness canary test'));
const commitment = sha256(concat(digest, new Uint8Array(16).fill(5)));

/** A pending receipt naming every built-in calendar at one synthetic commitment. */
function pendingReceipt(calendars: readonly string[] = CAL): Uint8Array {
  const node: TsNode = { msg: commitment, attestations: calendars.map((uri) => ({ kind: 'pending' as const, uri })), children: [] };
  const root: TsNode = { msg: digest, attestations: [], children: [{ op: { kind: 'append', arg: new Uint8Array(16).fill(5) }, node: {
    msg: concat(digest, new Uint8Array(16).fill(5)), attestations: [], children: [{ op: { kind: 'sha256' }, node }],
  } }] };
  return serializeProof({ digest, root });
}

/** A complete calendar reply for `msg`, anchored at `height`, built only from synthetic operations. */
function completeReply(msg: Uint8Array, height: number): Uint8Array {
  const extra = Uint8Array.of(7, 7, 7);
  const appended = concat(msg, extra);
  const end: TsNode = { msg: sha256(appended), attestations: [{ kind: 'bitcoin', height }], children: [] };
  const mid: TsNode = { msg: appended, attestations: [], children: [{ op: { kind: 'sha256' }, node: end }] };
  return serializeTree({ msg, attestations: [], children: [{ op: { kind: 'append', arg: extra }, node: mid }] });
}

const corsBlocked = (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch'));
const bin = (b: Uint8Array, status = 200): Response => new Response(b as BodyInit, { status });

interface Seen { host: string; path: string }

/**
 * Pending lookups are CORS-blocked (as on the live calendars). Canary lookups answer with `canary(host, canaryRecord)`.
 */
function fakeFetch(canary: (host: string, hex: string, init: RequestInit) => Promise<Response>, seen: Seen[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    seen.push({ host: url.host, path: url.pathname });
    const m = /^\/timestamp\/([0-9a-f]+)$/.exec(url.pathname);
    if (!m) throw new Error(`unexpected request ${url.href}`);
    if (m[1] === toHex(commitment)) return corsBlocked();
    return canary(url.host, m[1]!, init);
  }) as typeof fetch;
}

const cfg = (fetchImpl: typeof fetch, over: Partial<StampConfig> = {}): StampConfig => ({
  calendars: CAL, minAccepted: 2, net: { fetchImpl }, liveness: true, ...over,
});

const readableCanary = async (host: string, hex: string): Promise<Response> => {
  const c = canaryFor(`https://${host}`);
  if (!c || c.commitment !== hex) return bin(new TextEncoder().encode('Not found'), 404);
  return bin(completeReply(fromHex(hex), c.height));
};

const livenessByHost = (r: Awaited<ReturnType<typeof upgrade>>): Record<string, string | undefined> =>
  Object.fromEntries(r.calendars.map((c) => [new URL(c.url).host, c.liveness]));

describe('liveness canary table (evidence-backed, R1 targets)', () => {
  const r1 = JSON.parse(readFileSync(resolve('docs/evidence/r1-targets-20261105.json'), 'utf8')) as {
    initialSameCommitmentProbe: { inputReceiptSha256: string; observations: { url: string }[] };
    targets: { target: string; nonBrowserProbe: { url: string; status: number; acao: string; bitcoin: { height: number }[] };
      browser: { classification: string; requests: { host: string; kind: string; status: number; acao: string }[] } }[];
  };
  const alice = JSON.parse(readFileSync(resolve('docs/evidence/browser-20261105-network.json'), 'utf8')) as {
    confirmedAliceUpgrade: { fixtureSha256: string; reference: { bitcoin: { height: number }[] };
      browser: { classification: string; requests: { host: string; kind: string; status: number; acao: string }[] } };
  };

  it('has exactly one canary for every built-in calendar, and none for any other host', () => {
    expect(LIVENESS_CANARIES.map((c) => c.base).sort()).toEqual([...DEFAULT_CALENDARS].sort());
    for (const c of LIVENESS_CANARIES) {
      expect(c.commitment).toMatch(/^[0-9a-f]+$/);
      expect(c.commitment.length % 2).toBe(0);
      expect(Number.isSafeInteger(c.height) && c.height > 0).toBe(true);
    }
    expect(canaryFor('https://evil.example')).toBeUndefined();
    expect(canaryFor('https://alice.btc.calendar.opentimestamps.org/')).toBe(canaryFor('https://alice.btc.calendar.opentimestamps.org'));
  });

  for (const target of ['bob', 'finney'] as const) {
    it(`${target}: the canary is the recorded R1 commitment whose completed reply was browser-readable (200, ACAO *)`, () => {
      const t = r1.targets.find((x) => x.target === target)!;
      const url = new URL(t.nonBrowserProbe.url);
      const c = canaryFor(url.origin)!;
      expect(url.pathname).toBe(`/timestamp/${c.commitment}`);
      expect([t.nonBrowserProbe.status, t.nonBrowserProbe.acao]).toEqual([200, '*']);
      expect(t.nonBrowserProbe.bitcoin.map((b) => b.height)).toEqual([c.height]);
      expect(t.browser.classification).toBe('PASS');
      expect(t.browser.requests.filter((q) => q.kind === 'upgrade')).toEqual([{ host: url.host, method: 'GET', kind: 'upgrade', status: 200, acao: '*' }]);
    });
  }

  it('alice: the canary is the commitment of the recorded upstream receipt whose browser upgrade read 200 with ACAO *', () => {
    const c = canaryFor('https://alice.btc.calendar.opentimestamps.org')!;
    // The same upstream receipt (by SHA-256) names only Alice; its pending commitment is recorded in the Bob/Finney probe.
    expect(r1.initialSameCommitmentProbe.inputReceiptSha256).toBe(alice.confirmedAliceUpgrade.fixtureSha256);
    for (const o of r1.initialSameCommitmentProbe.observations) expect(new URL(o.url).pathname).toBe(`/timestamp/${c.commitment}`);
    expect(alice.confirmedAliceUpgrade.reference.bitcoin.map((b) => b.height)).toEqual([c.height]);
    expect(alice.confirmedAliceUpgrade.browser.classification).toBe('PASS');
    expect(alice.confirmedAliceUpgrade.browser.requests.filter((q) => q.kind === 'upgrade'))
      .toEqual([{ host: 'alice.btc.calendar.opentimestamps.org', method: 'GET', kind: 'upgrade', status: 200, acao: '*' }]);
  });

  it('never sends one calendar\'s canary to another calendar (each commitment is calendar-specific)', () => {
    expect(new Set(LIVENESS_CANARIES.map((c) => c.commitment)).size).toBe(LIVENESS_CANARIES.length);
  });
});

describe('upgrade with the liveness canary', () => {
  it('reports reachable when the canary reads and parses as the recorded completed timestamp; the receipt is untouched', async () => {
    const seen: Seen[] = [];
    const original = pendingReceipt();
    const r = await upgrade(original, cfg(fakeFetch(readableCanary, seen)));
    expect(r.status).toBe('pending');
    expect(r.changed).toBe(false);
    expect(toHex(r.ots)).toBe(toHex(original));
    expect(r.calendars.every((c) => !c.ok && c.unreadable === true)).toBe(true);
    expect(livenessByHost(r)).toEqual(Object.fromEntries(CAL.map((u) => [new URL(u).host, 'reachable'])));
    // One pending lookup plus exactly one canary per calendar, each canary at that calendar's own recorded commitment.
    for (const c of LIVENESS_CANARIES) {
      const host = new URL(c.base).host;
      expect(seen.filter((s) => s.host === host).map((s) => s.path).sort())
        .toEqual([`/timestamp/${toHex(commitment)}`, `/timestamp/${c.commitment}`].sort());
    }
  });

  it('reports unreachable or blocked when the canary is unreadable too', async () => {
    const r = await upgrade(pendingReceipt(), cfg(fakeFetch(corsBlocked)));
    expect(r.status).toBe('pending');
    expect(Object.values(livenessByHost(r))).toEqual(['unreachable', 'unreachable', 'unreachable']);
  });

  it('reports unknown, never pending or reachable, for a malformed canary reply', async () => {
    for (const body of [Uint8Array.of(), Uint8Array.of(0xff), new TextEncoder().encode('<html>maintenance</html>')]) {
      const r = await upgrade(pendingReceipt(), cfg(fakeFetch(async () => bin(body))));
      expect(Object.values(livenessByHost(r))).toEqual(['unknown', 'unknown', 'unknown']);
      expect(r.status).toBe('pending');
    }
  });

  it('reports unknown when the reply is a valid timestamp but not the recorded canary (commitment mismatch)', async () => {
    // A complete timestamp at a different Bitcoin height, or a merely pending one, is not the recorded canary's timestamp.
    const wrongHeight = async (host: string, hex: string): Promise<Response> => bin(completeReply(fromHex(hex), canaryFor(`https://${host}`)!.height + 1));
    const pendingOnly = async (host: string, hex: string): Promise<Response> => bin(serializeTree({ msg: fromHex(hex), attestations: [{ kind: 'pending', uri: `https://${host}` }], children: [] }));
    for (const reply of [wrongHeight, pendingOnly]) {
      const r = await upgrade(pendingReceipt(), cfg(fakeFetch(reply)));
      expect(Object.values(livenessByHost(r))).toEqual(['unknown', 'unknown', 'unknown']);
    }
  });

  it('reports unknown for readable non-200 answers and for oversized replies (existing byte limit)', async () => {
    for (const status of [404, 500]) {
      const r = await upgrade(pendingReceipt(), cfg(fakeFetch(async () => bin(new TextEncoder().encode('no'), status))));
      expect(Object.values(livenessByHost(r))).toEqual(['unknown', 'unknown', 'unknown']);
    }
    const big = async (host: string, hex: string): Promise<Response> => bin(concat(completeReply(fromHex(hex), canaryFor(`https://${host}`)!.height), new Uint8Array(300 * 1024)));
    const r = await upgrade(pendingReceipt(), cfg(fakeFetch(big)));
    expect(Object.values(livenessByHost(r))).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('reports unreachable when the canary times out under the existing time limit', async () => {
    const hang = (_host: string, _hex: string, init: RequestInit): Promise<Response> => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')), { once: true });
    });
    const started = Date.now();
    const r = await upgrade(pendingReceipt(), cfg(fakeFetch(hang), { net: { fetchImpl: fakeFetch(hang), timeoutMs: 50 } }));
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(Object.values(livenessByHost(r))).toEqual(['unreachable', 'unreachable', 'unreachable']);
  });

  it('propagates cancellation during the canary as ABORTED', async () => {
    const controller = new AbortController();
    let canaries = 0;
    const hang = (_host: string, _hex: string, init: RequestInit): Promise<Response> => new Promise((_res, rej) => {
      canaries++;
      if (canaries === 1) queueMicrotask(() => controller.abort());
      init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')), { once: true });
    });
    await expect(upgrade(pendingReceipt(), cfg(fakeFetch(hang), { signal: controller.signal }))).rejects.toMatchObject({ code: 'ABORTED' });
  });

  it('is off unless requested: no canary request and no liveness field', async () => {
    const seen: Seen[] = [];
    const r = await upgrade(pendingReceipt(), cfg(fakeFetch(readableCanary, seen), { liveness: false }));
    expect(seen.map((s) => s.path)).toEqual(CAL.map(() => `/timestamp/${toHex(commitment)}`));
    expect(r.calendars.every((c) => !('liveness' in c))).toBe(true);
  });

  it('does not probe calendars whose pending reply was readable, nor after another calendar confirmed the receipt', async () => {
    const seen: Seen[] = [];
    const readable404 = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push({ host: url.host, path: url.pathname });
      return bin(new TextEncoder().encode('Pending confirmation in Bitcoin blockchain'), 404);
    }) as typeof fetch;
    const r1 = await upgrade(pendingReceipt(), cfg(readable404));
    expect(seen).toHaveLength(3);
    expect(r1.calendars.every((c) => c.liveness === undefined)).toBe(true);

    seen.length = 0;
    const aliceConfirms = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push({ host: url.host, path: url.pathname });
      if (url.host === 'alice.btc.calendar.opentimestamps.org') return bin(completeReply(commitment, 800_000));
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const r2 = await upgrade(pendingReceipt(), cfg(aliceConfirms));
    expect(r2.status).toBe('bitcoin-confirmed');
    expect(seen).toHaveLength(3);
    expect(r2.calendars.every((c) => c.liveness === undefined)).toBe(true);
  });

  it('sends at most one canary per calendar per upgrade attempt, even with several pending commitments there', async () => {
    const seen: Seen[] = [];
    const root: TsNode = { msg: digest, attestations: [], children: [
      { op: { kind: 'append', arg: Uint8Array.of(1) }, node: { msg: concat(digest, Uint8Array.of(1)), attestations: [], children: [
        { op: { kind: 'sha256' }, node: { msg: sha256(concat(digest, Uint8Array.of(1))), attestations: [{ kind: 'pending', uri: CAL[0]! }], children: [] } }] } },
      { op: { kind: 'sha256' }, node: { msg: sha256(digest), attestations: [{ kind: 'pending', uri: CAL[0]! }], children: [] } },
    ] };
    const f = (async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      seen.push({ host: url.host, path: url.pathname });
      const c = canaryFor(url.origin)!;
      if (url.pathname === `/timestamp/${c.commitment}`) return readableCanary(url.host, c.commitment);
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const r = await upgrade(serializeProof({ digest, root }), cfg(f));
    const canary = canaryFor(CAL[0]!)!;
    expect(seen.filter((s) => s.path === `/timestamp/${canary.commitment}`)).toHaveLength(1);
    expect(seen).toHaveLength(3);
    expect(r.calendars).toHaveLength(2);
    expect(r.calendars.every((c) => c.liveness === 'reachable')).toBe(true);
  });

  it('sends the canary through the caller\'s network policy (allowlist, fetch seam, limits)', async () => {
    const seen: Seen[] = [];
    const f = fakeFetch(readableCanary, seen);
    const r = await upgrade(pendingReceipt([CAL[0]!]), cfg(f, { calendars: [CAL[0]!], net: { fetchImpl: f, allowedHosts: new Set(['alice.btc.calendar.opentimestamps.org']) } }));
    expect(r.calendars.map((c) => c.liveness)).toEqual(['reachable']);
    expect(seen).toHaveLength(2);
  });
});
