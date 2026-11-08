// FR-7 step 5 and ADR-006: VERIFIED needs block header agreement from at least two independent sources,
// whatever minimum a caller passes. Synthetic headers and explorers only.
import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { esploraSource, headerQuorum } from '../../src/core/ots/bitcoin';
import { serializeProof } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';
import { verify } from '../../src/core/ots/verify';
import { explorer, makeHeader, routerFetch } from '../helpers/chain';

const digest = sha256(new TextEncoder().encode('quorum floor fixture'));
const HEIGHT = 800_000;

function anchoredProof(): { ots: Uint8Array; header: Uint8Array } {
  const appended = concat(digest, Uint8Array.of(1, 2, 3));
  const merkleRoot = sha256(appended);
  const end: TsNode = { msg: merkleRoot, attestations: [{ kind: 'bitcoin', height: HEIGHT }], children: [] };
  const mid: TsNode = { msg: appended, attestations: [], children: [{ op: { kind: 'sha256' }, node: end }] };
  const root: TsNode = { msg: digest, attestations: [], children: [{ op: { kind: 'append', arg: Uint8Array.of(1, 2, 3) }, node: mid }] };
  return { ots: serializeProof({ digest, root }), header: makeHeader(merkleRoot).raw };
}

describe('explorer quorum floor (FR-7 step 5, ADR-006, SR-10)', () => {
  for (const minSources of [1, 0, -1, Number.NaN]) {
    it(`never reports VERIFIED from a single explorer when minSources is ${String(minSources)}`, async () => {
      const { ots, header } = anchoredProof();
      const f = routerFetch(explorer('mempool.space', { [HEIGHT]: header }));
      const r = await verify(digest, ots, { sources: [esploraSource('https://mempool.space', { fetchImpl: f })], minSources });
      expect(r.state).toBe('UNREACHABLE');
      expect(r.bitcoin).toBeUndefined();
      expect(r.detail).toContain('at least 2 needed');
    });
  }

  it('headerQuorum itself refuses agreement from one source when asked for fewer than two', async () => {
    const { header } = anchoredProof();
    const one = { id: 'only.example', fetchHeader: async () => header.slice() };
    for (const minSources of [1, 0, Number.NaN]) {
      expect((await headerQuorum([one], HEIGHT, minSources)).state).toBe('unreachable');
    }
  });

  it('still honours a stricter caller minimum', async () => {
    const { header } = anchoredProof();
    const src = (id: string) => ({ id, fetchHeader: async () => header.slice() });
    expect((await headerQuorum([src('a'), src('b')], HEIGHT, 3)).state).toBe('unreachable');
    expect((await headerQuorum([src('a'), src('b'), src('c')], HEIGHT, 3)).state).toBe('agreed');
    expect((await headerQuorum([src('a'), src('b')], HEIGHT, 2)).state).toBe('agreed');
  });
});
