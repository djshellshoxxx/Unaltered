import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { concat, fromHex, toHex } from '../../src/core/bytes';
import { collectAttestations, parseProof, serializeProof } from '../../src/core/ots/codec';
import { HEADER_MAGIC, LIMITS } from '../../src/core/ots/types';

const dir = 'tests/fixtures/ots';
const load = (n: string): Uint8Array => new Uint8Array(readFileSync(join(dir, n)));
const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8')) as Record<string, any>;

describe('codec vs reference fixtures (python-opentimestamps)', () => {
  for (const f of ['pending.ots', 'confirmed.ots', 'batch0.ots', 'batch1.ots', 'batch2.ots']) {
    it(`${f}: parses and re-serialises byte-identically`, () => {
      const bytes = load(f);
      const p = parseProof(bytes);
      expect(toHex(serializeProof(p))).toBe(toHex(bytes));
    });
  }

  it('reads attestations and commitments like the reference', () => {
    const p = parseProof(load('confirmed.ots'));
    const atts = collectAttestations(p.root);
    const btc = atts.filter((a) => a.attestation.kind === 'bitcoin');
    expect(toHex(p.digest)).toBe(expected['confirmed.ots'].digest);
    expect(btc).toHaveLength(1);
    expect(toHex(btc[0]!.node.msg)).toBe(expected['confirmed.ots'].bitcoin[0].commitment);
    expect((btc[0]!.attestation as { height: number }).height).toBe(358391);
    const pend = atts.filter((a) => a.attestation.kind === 'pending');
    expect(pend.map((a) => (a.attestation as { uri: string }).uri)).toEqual(expected['confirmed.ots'].pending);
  });

  it('batch proofs share the same tip commitment', () => {
    const tips = [0, 1, 2].map((i) => {
      const p = parseProof(load(`batch${i}.ots`));
      expect(toHex(p.digest)).toBe(expected.batch.digests[i]);
      const l = collectAttestations(p.root).filter((a) => a.attestation.kind === 'pending');
      expect(l).toHaveLength(1);
      return toHex(l[0]!.node.msg);
    });
    expect(new Set(tips)).toEqual(new Set([expected.batch.tip]));
  });

  it('fails closed on a Litecoin attestation', () => {
    expect(() => parseProof(load('litecoin.ots'))).toThrowError(/Litecoin/);
  });

  it('python reference reads what we serialise (when python-opentimestamps is available)', () => {
    const py = process.env.UNALTERED_PYTHON ?? '/tmp/venv/bin/python';
    if (!existsSync(py)) return;
    const tmp = mkdtempSync(join(tmpdir(), 'ots-'));
    const files: string[] = [];
    for (const f of ['pending.ots', 'confirmed.ots', 'batch0.ots']) {
      const out = join(tmp, f);
      writeFileSync(out, serializeProof(parseProof(load(f))));
      files.push(out);
    }
    const res = JSON.parse(execFileSync(py, ['-I', 'tests/differential/read_ours.py', ...files], { encoding: 'utf8' })) as Record<string, any>;
    expect(res[files[1]!].digest).toBe(expected['confirmed.ots'].digest);
    expect(res[files[1]!].attestations.filter((a: any) => a.type === 'bitcoin')[0].height).toBe(358391);
    expect(res[files[0]!].attestations[0].commitment).toBe(expected['pending.ots'].commitment);
  });
});

describe('codec rejects hostile input (SR-9, SR-10)', () => {
  const good = load('confirmed.ots');

  it('rejects wrong magic, empty and tiny input', () => {
    expect(() => parseProof(new Uint8Array(0))).toThrow();
    expect(() => parseProof(Uint8Array.of(1, 2, 3))).toThrow();
    const bad = good.slice();
    bad[3] = bad[3]! ^ 0xff;
    expect(() => parseProof(bad)).toThrow(/not an OpenTimestamps/);
  });

  it('rejects every truncation of a valid proof', () => {
    for (let n = 0; n < good.length; n++) expect(() => parseProof(good.slice(0, n))).toThrow();
  });

  it('rejects trailing bytes', () => {
    expect(() => parseProof(concat(good, Uint8Array.of(0)))).toThrow(/after the end/);
  });

  it('rejects unknown op and attestation tags', () => {
    const head = concat(HEADER_MAGIC, Uint8Array.of(1, 0x08), new Uint8Array(32));
    expect(() => parseProof(concat(head, Uint8Array.of(0x42)))).toThrow(/unknown operation/);
    expect(() => parseProof(concat(head, Uint8Array.of(0x00), new Uint8Array(8).fill(7), Uint8Array.of(0)))).toThrow(/unknown attestation/);
    expect(() => parseProof(concat(head, Uint8Array.of(0x02)))).toThrow(/not support/); // sha1 recognised but refused
  });

  it('rejects non-SHA-256 file digest (SR-12) and unsupported version', () => {
    expect(() => parseProof(concat(HEADER_MAGIC, Uint8Array.of(1, 0x02), new Uint8Array(20), Uint8Array.of(0x08)))).toThrow(/other than SHA-256/);
    expect(() => parseProof(concat(HEADER_MAGIC, Uint8Array.of(2, 0x08), new Uint8Array(32)))).toThrow(/version/);
  });

  it('enforces size, depth and length caps without recursion', () => {
    expect(() => parseProof(new Uint8Array(LIMITS.maxInputBytes + 1))).toThrow(/too large/);
    // 300 nested sha256 ops (depth cap 256)
    const deep = concat(HEADER_MAGIC, Uint8Array.of(1, 0x08), new Uint8Array(32), new Uint8Array(300).fill(0x08), Uint8Array.of(0));
    expect(() => parseProof(deep)).toThrow(/nested|malformed|ends/i);
    // append with huge declared length
    const huge = concat(HEADER_MAGIC, Uint8Array.of(1, 0x08), new Uint8Array(32), Uint8Array.of(0xf0, 0xff, 0xff, 0xff, 0x7f));
    expect(() => parseProof(huge)).toThrow(/invalid length/);
    // pending URI with illegal characters
    const uri = new TextEncoder().encode('https://x/<script>');
    const att = concat(Uint8Array.of(uri.length), uri);
    const bad = concat(HEADER_MAGIC, Uint8Array.of(1, 0x08), new Uint8Array(32), Uint8Array.of(0), fromHex('83dfe30d2ef90c8e'), Uint8Array.of(att.length), att);
    expect(() => parseProof(bad)).toThrow(/invalid calendar/);
  });

  it('never throws anything but typed errors on random mutations, and stays fast (fuzz)', () => {
    fc.assert(
      fc.property(fc.nat(good.length - 1), fc.uint8Array({ minLength: 1, maxLength: 8 }), (at, patch) => {
        const m = good.slice();
        m.set(patch.subarray(0, Math.min(patch.length, m.length - at)), at);
        try {
          const p = parseProof(m);
          serializeProof(p); // anything that parses must serialise
        } catch (e) {
          expect((e as { name: string }).name).toBe('UnalteredError');
        }
      }),
      { numRuns: 3000 },
    );
  });

  it('random garbage never crashes the parser', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 400 }), (b) => {
        try {
          parseProof(concat(HEADER_MAGIC, Uint8Array.of(1, 0x08), new Uint8Array(32), b));
        } catch (e) {
          expect((e as { name: string }).name).toBe('UnalteredError');
        }
      }),
      { numRuns: 3000 },
    );
  });
});
