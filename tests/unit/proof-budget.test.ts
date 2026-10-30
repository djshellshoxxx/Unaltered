import { describe, expect, it } from 'vitest';
import { UnalteredError } from '../../src/core/errors';
import { defaultStampConfig, stamp, upgrade } from '../../src/core/ots/calendar';
import { applyOp } from '../../src/core/ots/ops';
import { mergeTree, parseProof, parseTimestampBody, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { LIMITS, type TsNode } from '../../src/core/ots/types';

const digest = new Uint8Array(32);
const leaf = (msg: Uint8Array = digest): TsNode => ({ msg, children: [], attestations: [] });
const bitcoin = (count: number): TsNode => ({ ...leaf(), attestations: Array.from({ length: count }, (_, i) => ({ kind: 'bitcoin', height: i + 1 })) });
const cfg = defaultStampConfig();

describe('aggregate receipt budgets', () => {
  it('does not accept calendar depth that overflows the stamped proof prefix', async () => {
    const deep = Uint8Array.from([...new Uint8Array(LIMITS.maxDepth - 1).fill(8), ...serializeTree(bitcoin(1))]);
    expect(() => parseTimestampBody(deep, digest)).not.toThrow();
    await expect(stamp(digest, { ...cfg, net: { fetchImpl: async () => new Response(deep) } })).rejects.toMatchObject({ code: 'NET_FAILED' });
  });

  it('rejects a bad calendar while preserving the two valid acceptances', async () => {
    const deep = Uint8Array.from([...new Uint8Array(LIMITS.maxDepth - 1).fill(8), ...serializeTree(bitcoin(1))]);
    const result = await stamp(digest, { ...cfg, net: { fetchImpl: async (url) => new Response(Uint8Array.from(String(url).startsWith(cfg.calendars[0]!) ? deep : serializeTree(bitcoin(1)))) } });
    expect(result.calendars.map((c) => c.ok)).toEqual([false, true, true]);
    expect(() => parseProof(result.ots)).not.toThrow();
  });

  for (const count of [2, LIMITS.maxAttestations]) {
    it(`preserves a valid ${count}-pending receipt when replies exceed its aggregate attestation budget`, async () => {
      const root = leaf();
      for (let i = 0; i < count; i++) {
        const op = { kind: 'append' as const, arg: Uint8Array.of(i) };
        root.children.push({ op, node: { ...leaf(applyOp(op, digest)), attestations: [{ kind: 'pending', uri: cfg.calendars[0]! }] } });
      }
      const original = serializeProof({ digest, root });
      const body = serializeTree(bitcoin(LIMITS.maxAttestations));
      let requests = 0;
      const result = await upgrade(original, { ...cfg, net: { fetchImpl: async () => {
        requests++;
        return new Response(Uint8Array.from(body));
      } } });
      expect(() => parseProof(result.ots)).not.toThrow();
      expect(result.ots).toEqual(original);
      expect(result.changed).toBe(false);
      expect(requests).toBe(count);
      expect(result.calendars).toHaveLength(count);
      expect(result.calendars.every((c) => !c.ok)).toBe(true);
    });
  }

  it('rolls back all mutations when aggregate validation rejects a merge', () => {
    const root = bitcoin(1);
    const before = serializeTree(root);
    const originalAttestations = root.attestations;
    expect(() => mergeTree(root, bitcoin(2), () => {
      root.attestations = root.attestations.filter((a) => a.kind !== 'bitcoin' || a.height !== 1);
      throw new UnalteredError('PROOF_TOO_LARGE', 'fixture budget');
    })).toThrow('fixture budget');
    expect(root.attestations).toBe(originalAttestations);
    expect(serializeTree(root)).toEqual(before);
  });
});
