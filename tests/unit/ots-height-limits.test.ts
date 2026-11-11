import { describe, expect, it } from 'vitest';
import { concat, writeVaruint } from '../../src/core/bytes';
import { defaultStampConfig, stamp, upgrade } from '../../src/core/ots/calendar';
import { collectAttestations, parseProof, parseTimestampBody, serializeProof, serializeTree } from '../../src/core/ots/codec';
import { ATT_BITCOIN, HEADER_MAGIC, type TsNode } from '../../src/core/ots/types';
import { verify } from '../../src/core/ots/verify';

const digest = new Uint8Array(32).fill(0x32);
// Wire fixtures are assembled independently of the serializer under test.
const timestamp = (height: number): Uint8Array => {
  const payload = Uint8Array.from(writeVaruint(height));
  return concat(Uint8Array.of(0), ATT_BITCOIN, Uint8Array.from(writeVaruint(payload.length)), payload);
};
const detached = (height: number): Uint8Array => concat(HEADER_MAGIC, Uint8Array.of(1, 8), digest, timestamp(height));
const bitcoinTree = (height: number): TsNode => ({ msg: digest, children: [], attestations: [{ kind: 'bitcoin', height }] });

describe('Bitcoin attestation height bounds', () => {
  // Current reference format cap: python-opentimestamps v0.5.0, core/notary.py TimeAttestation.MAX_HEIGHT.
  // https://github.com/opentimestamps/python-opentimestamps/blob/8c3dc6fbdf6fcba054e78643e9df5eccd8c9fce4/opentimestamps/core/notary.py#L27
  for (const height of [0, 800_000, 0xffff_ffff]) {
    it(`preserves the supported block height ${height}`, () => {
      const raw = detached(height);
      expect(collectAttestations(parseProof(raw).root)[0]!.attestation).toEqual({ kind: 'bitcoin', height });
      expect(serializeProof(parseProof(raw))).toEqual(raw);
    });
  }

  for (const height of [0x1_0000_0000, 0x1_0000_0001, Number.MAX_SAFE_INTEGER]) {
    it(`rejects block height ${height} in both receipts and calendar bodies`, () => {
      expect(() => parseProof(detached(height))).toThrowError(/block height/i);
      expect(() => parseTimestampBody(timestamp(height), digest)).toThrowError(/block height/i);
    });

    it(`never queries explorers for unsupported block height ${height}`, async () => {
      let requests = 0;
      const source = (id: string) => ({ id, fetchHeader: async () => { requests++; return new Uint8Array(80); } });
      const result = await verify(digest, detached(height), { sources: [source('one'), source('two')], minSources: 2 });
      expect(result.state).toBe('INVALID_PROOF');
      expect(result.bitcoin).toBeUndefined();
      expect(requests).toBe(0);
    });
  }

  it('refuses to emit an unsupported block height from an in-memory proof', () => {
    const root = bitcoinTree(0x1_0000_0000);
    expect(() => serializeTree(root)).toThrowError(/block height/i);
    expect(() => serializeProof({ digest, root })).toThrowError(/block height/i);
  });

  it('does not count a malformed calendar response as an acceptance', async () => {
    const cfg = defaultStampConfig();
    const result = stamp(digest, { ...cfg, randomBytes: (size) => new Uint8Array(size), net: {
      fetchImpl: async () => new Response(Uint8Array.from(timestamp(0x1_0000_0000))),
    } });
    await expect(result).rejects.toMatchObject({ code: 'NET_FAILED' });
  });

  it('retains the original pending receipt when an upgrade has an unsupported height', async () => {
    const cfg = defaultStampConfig();
    const original = serializeProof({ digest, root: {
      msg: digest, children: [], attestations: [{ kind: 'pending', uri: cfg.calendars[0]! }],
    } });
    const result = await upgrade(original, { ...cfg, net: {
      fetchImpl: async () => new Response(Uint8Array.from(timestamp(0x1_0000_0000))),
    } });
    expect(result.ots).toEqual(original);
    expect(result.changed).toBe(false);
    expect(result.status).toBe('pending');
    expect(result.calendars).toMatchObject([{ ok: false }]);
  });
});
