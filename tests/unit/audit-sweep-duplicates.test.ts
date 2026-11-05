// Duplicate sibling operations are ambiguous across reference versions: 0.4.5 retains the last, 0.5.0 rejects them.
// https://github.com/opentimestamps/python-opentimestamps/blob/8c3dc6fbdf6fcba054e78643e9df5eccd8c9fce4/opentimestamps/core/timestamp.py#L151
import { execFileSync } from 'node:child_process';
import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { collectAttestations, parseProof, parseTimestampBody, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { ATT_BITCOIN, HEADER_MAGIC, LIMITS, type Attestation, type TsNode } from '../../src/core/ots/types';
import { verify } from '../../src/core/ots/verify';
import { makeHeader } from '../helpers/chain';

const digest = new Uint8Array(32).fill(0x23);
const pending = { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' } as const;
const leaf = (msg: Uint8Array, attestations: Attestation[]): TsNode => ({ msg, attestations, children: [] });
const pendingBody = serializeTree(leaf(sha256(digest), [pending]));
const bitcoinBody = concat(Uint8Array.of(0), ATT_BITCOIN, Uint8Array.of(1, 42));
// Independent wire assembly: root has the SHA-256 operation twice, with conflicting attestation subtrees.
const duplicateBody = concat(Uint8Array.of(0xff, 8), bitcoinBody, Uint8Array.of(8), pendingBody);
const duplicateProof = concat(HEADER_MAGIC, Uint8Array.of(1, 8), digest, duplicateBody);

describe('duplicate operation ambiguity and canonical attestations', () => {
  it('rejects duplicate sibling operation tags in detached and calendar wire receipts', () => {
    expect(() => parseProof(duplicateProof)).toThrowError(/duplicate|repeat/i);
    expect(() => parseTimestampBody(duplicateBody, digest)).toThrowError(/duplicate|repeat/i);
  });

  it('never verifies the first of two duplicate operation branches before the reference discards it', async () => {
    const raw = makeHeader(sha256(digest)).raw;
    let requests = 0;
    const source = (id: string) => ({ id, fetchHeader: async () => { requests++; return raw; } });
    const result = await verify(digest, duplicateProof, { sources: [source('one'), source('two')], minSources: 2 });
    expect(result.state).toBe('INVALID_PROOF');
    expect(result.bitcoin).toBeUndefined();
    expect(requests).toBe(0);
  });

  it('refuses to serialize duplicate caller-built operation edges', () => {
    const child = leaf(sha256(digest), [pending]);
    const root: TsNode = { msg: digest, attestations: [], children: [
      { op: { kind: 'sha256' }, node: child }, { op: { kind: 'sha256' }, node: child },
    ] };
    expect(() => serializeProof({ digest, root })).toThrowError(/duplicate|repeat/i);
  });

  it('permits the same operation at different parent timestamps', () => {
    const child: TsNode = { msg: sha256(digest), attestations: [], children: [{
      op: { kind: 'sha256' }, node: leaf(sha256(sha256(digest)), [pending]),
    }] };
    const bytes = serializeProof({ digest, root: { msg: digest, attestations: [], children: [{ op: { kind: 'sha256' }, node: child }] } });
    expect(collectAttestations(parseProof(bytes).root)).toHaveLength(1);
  });

  for (const tag of [0xf0, 0xf1]) {
    it(`compares arguments by bytes for operation tag ${tag}`, () => {
      const body = (last: number): Uint8Array => concat(Uint8Array.of(0xff, tag, 1, 3), pendingBody, Uint8Array.of(tag, 1, last), pendingBody);
      expect(() => parseTimestampBody(body(3), digest)).toThrowError(/duplicate|repeat/i);
      expect(parseTimestampBody(body(4), digest).children).toHaveLength(2);
    });
  }

  for (const attestation of [pending, { kind: 'bitcoin', height: 42 } as const]) {
    it(`canonicalizes repeated ${attestation.kind} attestations to the reference set representation`, () => {
      const canonical = serializeTree(leaf(digest, [attestation]));
      const repeated = concat(Uint8Array.of(0xff), canonical, canonical);
      const parsed = parseTimestampBody(repeated, digest);
      expect(parsed.attestations).toHaveLength(1);
      expect(serializeTree(parsed)).toEqual(canonical);
      expect(serializeTree(leaf(digest, [attestation, attestation]))).toEqual(canonical);
    });
  }

  it('still counts duplicate wire attestations against the aggregate input budget', () => {
    const single = serializeTree(leaf(digest, [pending]));
    const repeated = (count: number): Uint8Array => concat(...Array.from({ length: count }, (_, i) =>
      concat(i + 1 < count ? Uint8Array.of(0xff) : new Uint8Array(), single)));
    expect(parseTimestampBody(repeated(LIMITS.maxAttestations), digest).attestations).toHaveLength(1);
    expect(() => parseTimestampBody(repeated(LIMITS.maxAttestations + 1), digest)).toThrowError(/too many attestations/i);
  });

  const python = process.env.UNALTERED_PYTHON;
  it.skipIf(!python)('pinned Python reference confirms that the earlier Bitcoin branch is not retained', () => {
    const script = 'import sys,json; from opentimestamps.core.serialize import BytesDeserializationContext; from opentimestamps.core.timestamp import DetachedTimestampFile; from opentimestamps.core.notary import BitcoinBlockHeaderAttestation; p=DetachedTimestampFile.deserialize(BytesDeserializationContext(sys.stdin.buffer.read())); print(json.dumps([a.height for _,a in p.timestamp.all_attestations() if isinstance(a,BitcoinBlockHeaderAttestation)]))';
    const result = execFileSync(python!, ['-I', '-c', script], { input: duplicateProof, encoding: 'utf8' });
    expect(JSON.parse(result)).toEqual([]);
  });
});
