import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import { serializeProof } from '../../src/core/ots/codec';
import { verifyWithTrustedHeader } from '../../src/core/ots/trusted-header';
import { makeHeader } from '../helpers/chain';
import { fromHex } from '../../src/core/bytes';

const digest = new Uint8Array(createHash('sha256').update('synthetic offline file').digest());
const header = makeHeader(digest);
const evidence = { height: 42, hashHex: header.hashHex, raw: header.raw };
const receipt = (height = 42): Uint8Array => serializeProof({ digest,
  root: { msg: digest, attestations: [{ kind: 'bitcoin', height }], children: [] },
});

it('matches supplied evidence without granting chain trust or using the network', () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden'); });
  try {
    const report = verifyWithTrustedHeader(digest, receipt(), evidence);
    expect(report.state).toBe('MATCHED_TRUSTED_HEADER');
    expect(report.trust).toBe('USER_SUPPLIED_HEADER');
    expect(report.bitcoin).toEqual({ height: 42, hashHex: header.hashHex, blockTimeUtc: '2023-11-14T22:13:20Z' });
    expect(report.detail).toContain('Chain membership and height remain trusted inputs');
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});

it('rejects a header whose hash does not match the supplied identity', () => {
  const changed = header.raw.slice(); changed[76] = changed[76]! ^ 1;
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, raw: changed }).state).toBe('INVALID_HEADER');
});

it('checks file identity, receipt syntax and the matching height', () => {
  expect(verifyWithTrustedHeader(new Uint8Array(32), receipt(), evidence).state).toBe('NO_MATCH_FILE');
  expect(verifyWithTrustedHeader(digest, receipt().slice(0, -1), evidence).state).toBe('INVALID_PROOF');
  expect(verifyWithTrustedHeader(digest, receipt(43), evidence).state).toBe('MISSING_HEADER');
});

it('never promotes a pending receipt or a wrong Merkle root', () => {
  const pending = serializeProof({ digest, root: { msg: digest,
    attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }], children: [] } });
  expect(verifyWithTrustedHeader(digest, pending, evidence).state).toBe('PENDING');
  const other = makeHeader(new Uint8Array(32));
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, raw: other.raw, hashHex: other.hashHex }).state).toBe('NO_MATCH_HEADER');
});

it.each([-1, 0.5, Number.NaN, Infinity, 0x1_0000_0000])('rejects supplied height %s', (height) => {
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, height }).state).toBe('INVALID_HEADER');
});

it.each(['', 'z'.repeat(64), '0'.repeat(63), header.hashHex + '\n'])('rejects malformed expected hash %s', (hashHex) => {
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, hashHex }).state).toBe('INVALID_HEADER');
});

it('rejects wrong header size and accepts RPC display-order uppercase hex', () => {
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, raw: new Uint8Array(81) }).state).toBe('INVALID_HEADER');
  expect(verifyWithTrustedHeader(digest, receipt(), { ...evidence, hashHex: header.hashHex.toUpperCase() }).state).toBe('MATCHED_TRUSTED_HEADER');
});

it('replays proof operations without mutating the receipt', () => {
  const derived = new Uint8Array(createHash('sha256').update(digest).digest());
  const proof = serializeProof({ digest, root: { msg: digest, attestations: [], children: [
    { op: { kind: 'sha256' }, node: { msg: derived, attestations: [{ kind: 'bitcoin', height: 42 }], children: [] } },
  ] } });
  const h = makeHeader(derived); const original = proof.slice();
  expect(verifyWithTrustedHeader(digest, proof, { height: 42, raw: h.raw, hashHex: h.hashHex }).state).toBe('MATCHED_TRUSTED_HEADER');
  expect(proof).toEqual(original);
});

it('checks a real Bitcoin genesis header vector without asserting supplied chain membership', () => {
  const raw = fromHex('0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c');
  const merkle = raw.slice(36, 68);
  const proof = serializeProof({ digest: merkle, root: { msg: merkle, attestations: [{ kind: 'bitcoin', height: 0 }], children: [] } });
  const result = verifyWithTrustedHeader(merkle, proof, { height: 0, raw,
    hashHex: '000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f' });
  expect(result.state).toBe('MATCHED_TRUSTED_HEADER');
  expect(result.bitcoin?.blockTimeUtc).toBe('2009-01-03T18:15:05Z');
});

it('retains the existing distinct Bitcoin attestation resource bound', () => {
  const proof = serializeProof({ digest, root: { msg: digest, children: [],
    attestations: Array.from({ length: 17 }, (_, height) => ({ kind: 'bitcoin' as const, height })),
  } });
  expect(verifyWithTrustedHeader(digest, proof, evidence).state).toBe('INVALID_PROOF');
});
