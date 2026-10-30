import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { concat, fromHex, toHex } from '../../src/core/bytes';
import { parseHeader } from '../../src/core/ots/bitcoin';
import { esploraSource } from '../../src/core/ots/bitcoin';
import { stamp, stampBatch, upgrade, type StampConfig } from '../../src/core/ots/calendar';
import { collectAttestations, mergeTree, parseProof, serializeProof } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';
import { verify, type VerifyConfig } from '../../src/core/ots/verify';
import { calendar, explorer, makeHeader, routerFetch, text } from '../helpers/chain';

const digest = sha256(new TextEncoder().encode('hello unaltered'));
const CAL = ['https://alice.btc.calendar.opentimestamps.org', 'https://bob.btc.calendar.opentimestamps.org', 'https://finney.calendar.eternitywall.com'];
const hostOf = (u: string): string => new URL(u).host;

const cfgWith = (fetchImpl: typeof fetch, over: Partial<StampConfig> = {}): StampConfig => ({
  calendars: CAL,
  minAccepted: 2,
  net: { fetchImpl },
  randomBytes: (n) => new Uint8Array(n).fill(7),
  ...over,
});

/** Calendar subtree that anchors the commitment in Bitcoin, returning the Merkle root it commits to. */
function chainFor(commitment: Uint8Array, height: number): { tree: TsNode; root: Uint8Array } {
  const append = concat(commitment, Uint8Array.of(9, 9, 9));
  const root = sha256(append);
  const mid: TsNode = { msg: append, attestations: [], children: [] };
  const end: TsNode = { msg: root, attestations: [{ kind: 'bitcoin', height }], children: [] };
  mid.children.push({ op: { kind: 'sha256' }, node: end });
  const top: TsNode = { msg: commitment, attestations: [], children: [{ op: { kind: 'append', arg: Uint8Array.of(9, 9, 9) }, node: mid }] };
  return { tree: top, root };
}

describe('stamp (FR-4)', () => {
  it('posts sha256(digest||nonce) to every calendar, never the file digest, and builds a reference-compatible proof', async () => {
    const seen: string[] = [];
    const f = routerFetch(...CAL.map((u) => calendar(hostOf(u), { onDigest: (d) => ((seen.push(toHex(d))), { msg: d, attestations: [{ kind: 'pending', uri: u }], children: [] }) })));
    const r = await stamp(digest, cfgWith(f));
    const tip = toHex(sha256(concat(digest, new Uint8Array(16).fill(7))));
    expect(seen).toEqual([tip, tip, tip]);
    expect(seen.join()).not.toContain(toHex(digest));
    expect(r.calendars.every((c) => c.ok)).toBe(true);
    const p = parseProof(r.ots);
    expect(toHex(p.digest)).toBe(toHex(digest));
    const pend = collectAttestations(p.root).filter((a) => a.attestation.kind === 'pending');
    expect(pend).toHaveLength(3);
    expect(pend.every((a) => toHex(a.node.msg) === tip)).toBe(true);
  });

  it('succeeds with M=2 when one calendar fails and reports which', async () => {
    const f = routerFetch(calendar(hostOf(CAL[0]!)), calendar(hostOf(CAL[1]!)), calendar(hostOf(CAL[2]!), { status: 500 }));
    const r = await stamp(digest, cfgWith(f));
    expect(r.calendars.filter((c) => !c.ok)).toHaveLength(1);
  });

  it('fails with a per-calendar report when fewer than M accept', async () => {
    const f = routerFetch(calendar(hostOf(CAL[0]!)), calendar(hostOf(CAL[1]!), { status: 503 }), calendar(hostOf(CAL[2]!), { status: 500 }));
    await expect(stamp(digest, cfgWith(f))).rejects.toMatchObject({ code: 'NET_FAILED' });
  });

  it('refuses to contact hosts that are not on the allowlist', async () => {
    const f = routerFetch(() => text('never'));
    const r = stamp(digest, cfgWith(f, { calendars: ['https://evil.example'], minAccepted: 1 }));
    await expect(r).rejects.toMatchObject({ code: 'NET_FAILED' });
  });

  it('batch: one request, per-file proofs share the tip and each verifies its own digest (FR-10)', async () => {
    let posts = 0;
    const f = routerFetch(...CAL.map((u) => calendar(hostOf(u), { onDigest: (d) => ((posts++), { msg: d, attestations: [{ kind: 'pending', uri: u }], children: [] }) })));
    const digs = [1, 2, 3, 4, 5].map((i) => sha256(Uint8Array.of(i)));
    const r = await stampBatch(digs, cfgWith(f));
    expect(posts).toBe(3);
    const tips = new Set<string>();
    r.proofs.forEach((bytes, i) => {
      const p = parseProof(bytes);
      expect(toHex(p.digest)).toBe(toHex(digs[i]!));
      for (const a of collectAttestations(p.root)) if (a.attestation.kind === 'pending') tips.add(toHex(a.node.msg));
    });
    expect(tips.size).toBe(1);
  });
});

describe('upgrade (FR-6)', () => {
  async function pendingProof(): Promise<Uint8Array> {
    const f = routerFetch(...CAL.map((u) => calendar(hostOf(u))));
    return (await stamp(digest, cfgWith(f))).ots;
  }

  it('stays pending (and unchanged) while calendars answer 404', async () => {
    const ots = await pendingProof();
    const f = routerFetch(...CAL.map((u) => calendar(hostOf(u))));
    const r = await upgrade(ots, cfgWith(f));
    expect(r.status).toBe('pending');
    expect(r.changed).toBe(false);
  });

  it('marks calendars unreadable (not confirmed, not thrown) when the browser cannot read the pending reply', async () => {
    const ots = await pendingProof();
    // A cross-origin 404 without Access-Control-Allow-Origin surfaces in a browser as a TypeError from fetch.
    const corsBlocked = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const r = await upgrade(ots, cfgWith(corsBlocked));
    expect(r.status).toBe('pending');
    expect(r.changed).toBe(false);
    expect(r.calendars).toHaveLength(3);
    expect(r.calendars.every((c) => !c.ok && c.unreadable === true)).toBe(true);
  });

  it('does not mark readable HTTP errors as unreadable', async () => {
    const ots = await pendingProof();
    const f = routerFetch(() => text('nope', 500));
    const r = await upgrade(ots, cfgWith(f));
    expect(r.calendars.every((c) => !c.ok && c.unreadable === undefined)).toBe(true);
  });

  it('merges the Bitcoin attestation and drops the satisfied pending one', async () => {
    const ots = await pendingProof();
    const p = parseProof(ots);
    const leafHex = toHex(collectAttestations(p.root)[0]!.node.msg);
    const { tree } = chainFor(fromHex(leafHex), 800_000);
    const f = routerFetch(calendar(hostOf(CAL[0]!), { upgrades: new Map([[leafHex, tree]]) }), calendar(hostOf(CAL[1]!)), calendar(hostOf(CAL[2]!)));
    const r = await upgrade(ots, cfgWith(f));
    expect(r.status).toBe('bitcoin-confirmed');
    expect(r.changed).toBe(true);
    const atts = collectAttestations(parseProof(r.ots).root).map((a) => a.attestation.kind + ('uri' in a.attestation ? a.attestation.uri : ''));
    expect(atts).toContain('bitcoin');
    expect(atts.filter((a) => a.startsWith('pending'))).toHaveLength(2); // alice's satisfied one is gone
  });

  it('does not contact calendars named in a proof that are off the allowlist', async () => {
    const root: TsNode = { msg: digest, attestations: [{ kind: 'pending', uri: 'https://evil.example' }], children: [] };
    const ots = serializeProof({ digest, root });
    const f = routerFetch(() => text('x'));
    const r = await upgrade(ots, cfgWith(f));
    expect(r.unknownCalendars).toEqual(['https://evil.example']);
    expect(r.changed).toBe(false);
  });
});

describe('verify (FR-7, SR-10)', () => {
  const build = (height = 800_000): { ots: Uint8Array; root: Uint8Array } => {
    const { tree, root } = chainFor(digest, height);
    return { ots: serializeProof({ digest, root: tree }), root };
  };
  const sources = (hdrs: Record<string, Record<number, Uint8Array>>): VerifyConfig => {
    const f = routerFetch(...Object.entries(hdrs).map(([h, m]) => explorer(h, m)));
    return { sources: Object.keys(hdrs).map((h) => esploraSource(`https://${h}`, { fetchImpl: f })), minSources: 2 };
  };

  it('VERIFIED when file, commitment and two explorers agree', async () => {
    const { ots, root } = build();
    const h = makeHeader(root, 1_700_000_000).raw;
    const r = await verify(digest, ots, sources({ 'mempool.space': { 800_000: h }, 'blockstream.info': { 800_000: h } }));
    expect(r.state).toBe('VERIFIED');
    expect(r.bitcoin).toMatchObject({ height: 800_000, blockTimeUtc: '2023-11-14T22:13:20Z' });
    expect(r.bitcoin!.sourcesAgreeing.sort()).toEqual(['blockstream.info', 'mempool.space']);
  });

  it('NO_MATCH_FILE for a mutated file', async () => {
    const { ots, root } = build();
    const h = makeHeader(root).raw;
    const r = await verify(sha256(Uint8Array.of(1)), ots, sources({ 'mempool.space': { 800_000: h }, 'blockstream.info': { 800_000: h } }));
    expect(r.state).toBe('NO_MATCH_FILE');
  });

  it('INVALID_PROOF for mutated or truncated proofs, never VERIFIED', async () => {
    const { ots, root } = build();
    const h = makeHeader(root).raw;
    const cfg = sources({ 'mempool.space': { 800_000: h }, 'blockstream.info': { 800_000: h } });
    expect((await verify(digest, ots.slice(0, ots.length - 3), cfg)).state).toBe('INVALID_PROOF');
    // flip one byte of the appended data on the path: commitment no longer matches the header
    const bad = ots.slice();
    bad[bad.length - 14] = bad[bad.length - 14]! ^ 1;
    const r = await verify(digest, bad, cfg);
    expect(r.state).not.toBe('VERIFIED');
    expect(['INVALID_PROOF', 'NO_MATCH_FILE']).toContain(r.state);
  });

  it('INVALID_PROOF when the block header has a different Merkle root', async () => {
    const { ots } = build();
    const h = makeHeader(new Uint8Array(32).fill(1)).raw;
    expect((await verify(digest, ots, sources({ 'mempool.space': { 800_000: h }, 'blockstream.info': { 800_000: h } }))).state).toBe('INVALID_PROOF');
  });

  it('SOURCES_DISAGREE when explorers return different headers', async () => {
    const { ots, root } = build();
    const good = makeHeader(root, 1_700_000_000).raw;
    const other = makeHeader(root, 1_700_000_001).raw;
    const r = await verify(digest, ots, sources({ 'mempool.space': { 800_000: good }, 'blockstream.info': { 800_000: other } }));
    expect(r.state).toBe('SOURCES_DISAGREE');
  });

  it('UNREACHABLE with only one source, or when sources fail', async () => {
    const { ots, root } = build();
    const h = makeHeader(root).raw;
    expect((await verify(digest, ots, sources({ 'mempool.space': { 800_000: h }, 'blockstream.info': {} }))).state).toBe('UNREACHABLE');
    expect((await verify(digest, ots, sources({ 'mempool.space': { 800_000: h } }))).state).toBe('UNREACHABLE');
  });

  it('counts a duplicated source once (quorum needs distinct hosts)', async () => {
    const { ots, root } = build();
    const h = makeHeader(root).raw;
    const f = routerFetch(explorer('mempool.space', { 800_000: h }));
    const s = esploraSource('https://mempool.space', { fetchImpl: f });
    expect((await verify(digest, ots, { sources: [s, s], minSources: 2 })).state).toBe('UNREACHABLE');
  });

  it('rejects a header whose hash does not match the explorer-claimed block hash', async () => {
    const { ots, root } = build();
    const h = makeHeader(root).raw;
    const liar = (host: string) => (url: URL) => {
      if (url.host !== host) return null;
      if (url.pathname.startsWith('/api/block-height/')) return text('00'.repeat(32));
      return text(toHex(h));
    };
    const f = routerFetch(liar('mempool.space'), liar('blockstream.info'));
    const cfg: VerifyConfig = { sources: ['mempool.space', 'blockstream.info'].map((x) => esploraSource(`https://${x}`, { fetchImpl: f })), minSources: 2 };
    expect((await verify(digest, ots, cfg)).state).toBe('UNREACHABLE');
  });

  it('PENDING (never "match") for pending-only proofs', async () => {
    const root: TsNode = { msg: digest, attestations: [{ kind: 'pending', uri: CAL[0]! }], children: [] };
    const r = await verify(digest, serializeProof({ digest, root }), { sources: [], minSources: 2 });
    expect(r.state).toBe('PENDING');
    expect(r.pendingCalendars).toEqual([CAL[0]]);
  });

  it('verifies a reference-client proof end to end against synthetic headers', async () => {
    // confirmed.ots from python-opentimestamps commits to a known value at height 358391
    const { readFileSync } = await import('node:fs');
    const ots = new Uint8Array(readFileSync('tests/fixtures/ots/confirmed.ots'));
    const p = parseProof(ots);
    const commit = collectAttestations(p.root).find((a) => a.attestation.kind === 'bitcoin')!.node.msg;
    const h = makeHeader(commit).raw;
    const r = await verify(digest, ots, sources({ 'mempool.space': { 358391: h }, 'blockstream.info': { 358391: h } }));
    expect(r.state).toBe('VERIFIED');
  });
});

describe('header parsing against real chain data', () => {
  it('parses the Bitcoin genesis block header', () => {
    const raw = fromHex('0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c');
    const h = parseHeader(raw);
    expect(h.hashHex).toBe('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f');
    expect(toHex(h.merkleRoot)).toBe('3ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a');
    expect(h.time).toBe(1231006505);
  });
});

describe('mergeTree', () => {
  it('rejects merging trees for different messages', () => {
    const a: TsNode = { msg: Uint8Array.of(1), attestations: [], children: [] };
    const b: TsNode = { msg: Uint8Array.of(2), attestations: [], children: [] };
    expect(() => mergeTree(a, b)).toThrow();
  });
});

describe('review hardening: hostile proofs cannot cause unbounded work', () => {
  it('rejects proofs with too many attestations at parse time', () => {
    const atts = Array.from({ length: 300 }, (_, i) => ({ kind: 'bitcoin' as const, height: i + 1 }));
    const root: TsNode = { msg: digest, attestations: atts, children: [] };
    expect(() => parseProof(serializeProof({ digest, root }))).toThrow(/too many attestations/);
  });

  it('verify refuses many distinct Bitcoin attestations without any network request', async () => {
    const atts = Array.from({ length: 40 }, (_, i) => ({ kind: 'bitcoin' as const, height: i + 1 }));
    const ots = serializeProof({ digest, root: { msg: digest, attestations: atts, children: [] } });
    let calls = 0;
    const src = { id: 'x', fetchHeader: async () => ((calls++), new Uint8Array(80)) };
    const r = await verify(digest, ots, { sources: [src], minSources: 2 });
    expect(r.state).toBe('INVALID_PROOF');
    expect(calls).toBe(0);
  });

  it('upgrade sends one request per distinct pending attestation', async () => {
    const dup = Array.from({ length: 50 }, () => ({ kind: 'pending' as const, uri: CAL[0]! }));
    const ots = serializeProof({ digest, root: { msg: digest, attestations: dup, children: [] } });
    let gets = 0;
    const f = routerFetch((u) => (u.pathname.startsWith('/timestamp/') ? (gets++, text('p', 404)) : null));
    await upgrade(ots, cfgWith(f));
    expect(gets).toBe(1);
  });

  it('merges large trees in linear time', () => {
    const mk = (off: number): TsNode => ({ msg: digest, attestations: [], children: Array.from({ length: 6000 }, (_, i) => ({ op: { kind: 'append' as const, arg: Uint8Array.of((i + off) >> 8, (i + off) & 255, 1) }, node: { msg: Uint8Array.of(i), attestations: [], children: [] } })) });
    const t0 = Date.now();
    const a = mk(0);
    mergeTree(a, mk(3000));
    expect(a.children.length).toBe(9000);
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
