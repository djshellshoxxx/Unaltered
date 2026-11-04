// Canonical serialisation must order attestations like the reference implementations: by tag, then pending
// attestations by URI and Bitcoin attestations by block height (python-opentimestamps core/notary.py __lt__,
// javascript-opentimestamps notary.js compareTo). Synthetic fixtures only.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { concat, fromHex, toHex } from '../../src/core/bytes';
import { parseProof, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { HEADER_MAGIC, type Attestation, type TsNode } from '../../src/core/ots/types';

const digest = new Uint8Array(32).fill(0x11);
const node = (attestations: Attestation[]): TsNode => ({ msg: digest, attestations, children: [] });

// Timestamp bytes written by python-opentimestamps 0.4.5 (DetachedTimestampFile.serialize) for the same trees.
const REFERENCE = {
  pending: 'ff0083dfe30d2ef90c8e1a1968747470733a2f2f616c6963652e6578616d706c652e6f72670083dfe30d2ef90c8e121168747470733a2f2f622e6578616d706c65',
  bitcoin: 'ff000588960d73d7190103ffea30000588960d73d719010380eb30',
};

describe('canonical attestation order matches the reference implementation', () => {
  it('orders pending attestations by URI, not by encoded length', () => {
    const tree = node([{ kind: 'pending', uri: 'https://b.example' }, { kind: 'pending', uri: 'https://alice.example.org' }]);
    expect(toHex(serializeTree(tree))).toBe(REFERENCE.pending);
  });

  it('orders Bitcoin attestations by height, not by little-endian varint bytes', () => {
    const tree = node([{ kind: 'bitcoin', height: 800_128 }, { kind: 'bitcoin', height: 800_127 }]);
    expect(toHex(serializeTree(tree))).toBe(REFERENCE.bitcoin);
  });

  it('re-serialises receipts in reference canonical order byte-identically', () => {
    for (const tree of Object.values(REFERENCE)) {
      const bytes = concat(HEADER_MAGIC, Uint8Array.of(1, 8), digest, fromHex(tree));
      expect(toHex(serializeProof(parseProof(bytes)))).toBe(toHex(bytes));
    }
  });

  it('emits Bitcoin before pending, heights ascending and URIs ascending for any mix (property)', () => {
    const uri = fc.stringMatching(/^https:\/\/[a-z0-9.\-_/:]{1,40}$/);
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 2_000_000 }), { maxLength: 6 }), fc.uniqueArray(uri, { maxLength: 6 }), (heights, uris) => {
        fc.pre(heights.length + uris.length > 0);
        const atts: Attestation[] = [...uris.map((u) => ({ kind: 'pending' as const, uri: u })), ...heights.map((h) => ({ kind: 'bitcoin' as const, height: h }))];
        const parsed = parseProof(serializeProof({ digest, root: node(atts.reverse()) })).root.attestations;
        const expected = [
          ...[...heights].sort((a, b) => a - b).map((h) => `b:${h}`),
          ...[...uris].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((u) => `p:${u}`),
        ];
        expect(parsed.map((a) => (a.kind === 'bitcoin' ? `b:${a.height}` : `p:${a.uri}`))).toEqual(expected);
      }),
      { seed: 20261104, numRuns: 500 },
    );
  });
});
