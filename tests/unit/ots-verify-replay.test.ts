// FR-7 steps 3-4: verifyProof (exported) must replay the operations from the file digest itself instead of trusting
// commitments stored in a caller-built tree. Synthetic headers and explorers only.
import { sha256 } from '@noble/hashes/sha2.js';
import { describe, expect, it } from 'vitest';
import { esploraSource } from '../../src/core/ots/bitcoin';
import type { DetachedProof, TsNode } from '../../src/core/ots/types';
import { verifyProof, type VerifyConfig } from '../../src/core/ots/verify';
import { explorer, makeHeader, routerFetch } from '../helpers/chain';

const fileDigest = sha256(new TextEncoder().encode('the file the user dropped'));
const unrelatedRoot = sha256(new TextEncoder().encode('a block merkle root unrelated to the file'));
const HEIGHT = 800_000;

function agreeingExplorers(merkleRoot: Uint8Array): VerifyConfig {
  const header = makeHeader(merkleRoot).raw;
  const f = routerFetch(explorer('mempool.space', { [HEIGHT]: header }), explorer('blockstream.info', { [HEIGHT]: header }));
  return { sources: ['mempool.space', 'blockstream.info'].map((h) => esploraSource(`https://${h}`, { fetchImpl: f })), minSources: 2 };
}

describe('verifyProof replays commitments (FR-7, SR-10)', () => {
  it('does not report VERIFIED when the root commitment differs from the file digest', async () => {
    const proof: DetachedProof = {
      digest: fileDigest,
      root: { msg: unrelatedRoot, attestations: [{ kind: 'bitcoin', height: HEIGHT }], children: [] },
    };
    const r = await verifyProof(fileDigest, proof, agreeingExplorers(unrelatedRoot));
    expect(r.state).toBe('INVALID_PROOF');
    expect(r.bitcoin).toBeUndefined();
  });

  it('does not report VERIFIED when a stored commitment is not the result of its operation', async () => {
    const forged: TsNode = { msg: unrelatedRoot, attestations: [{ kind: 'bitcoin', height: HEIGHT }], children: [] };
    const proof: DetachedProof = { digest: fileDigest, root: { msg: fileDigest, attestations: [], children: [{ op: { kind: 'sha256' }, node: forged }] } };
    const r = await verifyProof(fileDigest, proof, agreeingExplorers(unrelatedRoot));
    expect(r.state).not.toBe('VERIFIED');
    expect(r.state).toBe('INVALID_PROOF');
  });

  it('still verifies a consistent caller-built proof', async () => {
    const tip = sha256(fileDigest);
    const proof: DetachedProof = {
      digest: fileDigest,
      root: { msg: fileDigest, attestations: [], children: [{ op: { kind: 'sha256' }, node: { msg: tip, attestations: [{ kind: 'bitcoin', height: HEIGHT }], children: [] } }] },
    };
    const r = await verifyProof(fileDigest, proof, agreeingExplorers(tip));
    expect(r.state).toBe('VERIFIED');
    expect(r.bitcoin?.height).toBe(HEIGHT);
  });

  it('still reports NO_MATCH_FILE for a consistent proof of another file', async () => {
    const other = sha256(Uint8Array.of(1));
    const proof: DetachedProof = { digest: other, root: { msg: other, attestations: [{ kind: 'pending', uri: 'https://alice.btc.calendar.opentimestamps.org' }], children: [] } };
    expect((await verifyProof(fileDigest, proof, agreeingExplorers(unrelatedRoot))).state).toBe('NO_MATCH_FILE');
  });
});
