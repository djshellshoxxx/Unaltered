// Exported serializers must not emit operation/attestation fields that their own standard bounded parser rejects.
// Reference limits: python-opentimestamps core/op.py BinaryOp and core/notary.py PendingAttestation.
import { describe, expect, it } from 'vitest';
import { parseProof, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { applyOp } from '../../src/core/ots/ops';
import { LIMITS, type Attestation, type DetachedProof, type Op, type TsNode } from '../../src/core/ots/types';
import { verifyProof } from '../../src/core/ots/verify';
import { makeHeader } from '../helpers/chain';

const digest = new Uint8Array(32).fill(0x45);
const leaf = (attestation: Attestation, msg: Uint8Array = digest): TsNode => ({ msg, attestations: [attestation], children: [] });
const pending = { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' } as const;
const withOp = (op: Op, childMessage: Uint8Array = digest): DetachedProof => ({ digest, root: { msg: digest, attestations: [], children: [{ op, node: leaf(pending, childMessage) }] } });

describe('in-memory serialization field validation', () => {
  for (const kind of ['append', 'prepend'] as const) {
    it.each([0, LIMITS.maxOpArg + 1])(`refuses ${kind} argument length %i before emitting a receipt`, (size) => {
      const proof = withOp({ kind, arg: new Uint8Array(size) });
      expect(() => serializeProof(proof)).toThrowError(/operation|argument/i);
      expect(() => serializeTree(proof.root)).toThrowError(/operation|argument/i);
    });

    it(`refuses a ${kind} result that exceeds the message limit despite a bounded argument`, () => {
      const proof = withOp({ kind, arg: new Uint8Array(LIMITS.maxMsg - digest.length + 1) });
      expect(() => serializeProof(proof)).toThrowError(/oversized|value|message/i);
    });

    it(`round-trips the largest valid ${kind} result`, () => {
      const op = { kind, arg: new Uint8Array(LIMITS.maxMsg - digest.length) };
      const encoded = serializeProof(withOp(op, applyOp(op, digest)));
      expect(() => parseProof(encoded)).not.toThrow();
    });
  }

  it.each(['', 'https://calendar.example/?private=1', 'https://calendar.example/\n', 'https://é.example/', 'x'.repeat(LIMITS.maxUri + 1)])('refuses an invalid pending URI %j', (uri) => {
    expect(() => serializeProof({ digest, root: leaf({ kind: 'pending', uri }) })).toThrowError(/calendar|address|URI/i);
  });

  it('never silently aliases an unknown operation kind to prepend', () => {
    const proof = withOp({ kind: 'unknown', arg: Uint8Array.of(1) } as unknown as Op);
    expect(() => serializeProof(proof)).toThrowError(/operation/i);
  });

  it('never verifies an unsupported runtime operation by silently treating it as prepend', async () => {
    const arg = Uint8Array.of(1);
    const prefixed = applyOp({ kind: 'prepend', arg }, digest);
    const tip = applyOp({ kind: 'sha256' }, prefixed);
    const header = makeHeader(tip).raw;
    const proof = withOp({ kind: 'unknown', arg } as unknown as Op, prefixed);
    proof.root.children[0]!.node = { msg: prefixed, attestations: [], children: [{
      op: { kind: 'sha256' }, node: leaf({ kind: 'bitcoin', height: 42 }, tip),
    }] };
    let requests = 0;
    const source = (id: string) => ({ id, fetchHeader: async () => { requests++; return header; } });
    const result = await verifyProof(digest, proof, { sources: [source('one'), source('two')], minSources: 2 });
    expect(result.state).toBe('INVALID_PROOF');
    expect(result.bitcoin).toBeUndefined();
    expect(requests).toBe(0);
  });

  it('never silently aliases an unknown attestation kind to pending', () => {
    const attestation = { kind: 'unknown', uri: pending.uri } as unknown as Attestation;
    expect(() => serializeProof({ digest, root: leaf(attestation) })).toThrowError(/attestation/i);
  });

  it('refuses non-byte operation arguments and non-string pending URIs', () => {
    expect(() => serializeProof(withOp({ kind: 'append', arg: [1] } as unknown as Op))).toThrowError(/operation|argument/i);
    expect(() => serializeProof({ digest, root: leaf({ kind: 'pending', uri: 42 } as unknown as Attestation) })).toThrowError(/calendar|address|URI/i);
  });
});
