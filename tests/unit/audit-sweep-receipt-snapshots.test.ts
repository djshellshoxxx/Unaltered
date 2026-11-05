import { describe, expect, it } from 'vitest';
import { parseProof, parseTimestampBody, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { applyOp } from '../../src/core/ots/ops';
import { HEADER_MAGIC, type TsNode } from '../../src/core/ots/types';
import { verify } from '../../src/core/ots/verify';
import { makeHeader } from '../helpers/chain';

const digest = new Uint8Array(32).fill(0x23);
const pending = { kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' } as const;
const tree = (kind: 'append' | 'prepend'): TsNode => {
  const op = { kind, arg: Uint8Array.of(5, 7) };
  return { msg: digest, attestations: [], children: [{
    op, node: { msg: applyOp(op, digest), attestations: [pending], children: [] },
  }] };
};

describe('parsed receipts retain private fingerprint and operation bytes', () => {
  for (const offset of [0, 9]) {
    for (const kind of ['append', 'prepend'] as const) {
      it(`preserves an offset-${offset} Buffer-backed ${kind} receipt after source mutation`, () => {
        const original = serializeProof({ digest, root: tree(kind) });
        const backing = Buffer.alloc(original.length + offset + 5);
        const input = backing.subarray(offset, offset + original.length);
        input.set(original);
        const parsed = parseProof(input);
        backing.fill(0);
        expect(parsed.digest).toEqual(digest);
        expect(parsed.root.msg).toEqual(digest);
        const op = parsed.root.children[0]!.op;
        expect(op.kind).toBe(kind);
        if (op.kind !== 'sha256') expect(op.arg).toEqual(Uint8Array.of(5, 7));
        expect(serializeProof(parsed)).toEqual(original);
      });
    }
  }

  it('copies operation arguments from a bare Buffer-backed calendar body too', () => {
    const input = Buffer.from(serializeTree(tree('append')));
    const parsed = parseTimestampBody(input, digest);
    input.fill(0);
    const op = parsed.children[0]!.op;
    if (op.kind === 'sha256') throw new Error('expected append fixture');
    expect(op.arg).toEqual(Uint8Array.of(5, 7));
  });

  it('does not change an asynchronously checked commitment when the original receipt Buffer changes', async () => {
    const otherMerkleRoot = new Uint8Array(32).fill(0x67);
    const raw = makeHeader(otherMerkleRoot).raw;
    const input = Buffer.from(serializeProof({ digest, root: { msg: digest, attestations: [{ kind: 'bitcoin', height: 42 }], children: [] } }));
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let requests = 0;
    const source = (id: string) => ({ id, fetchHeader: async () => { requests++; await held; return raw; } });
    const result = verify(digest, input, { sources: [source('one'), source('two')], minSources: 2 });
    expect(requests).toBe(2);
    // Digest equality was already checked, but the block header comparison has not completed.
    input.set(otherMerkleRoot, HEADER_MAGIC.length + 2);
    release();
    const report = await result;
    expect(report.state).toBe('INVALID_PROOF');
    expect(report.bitcoin).toBeUndefined();
  });
});
