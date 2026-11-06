import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseHeader } from '../../src/core/ots/bitcoin';
import { checkTrustedHeader } from '../../src/core/ots/trusted-header';
import { makeHeader } from '../helpers/chain';

const original = makeHeader(new Uint8Array(32).fill(0x52));
const doubleHash = (bytes: Uint8Array): string => createHash('sha256').update(createHash('sha256').update(bytes).digest()).digest().reverse().toString('hex');

describe('public header parsing retains private byte snapshots', () => {
  for (const offset of [0, 11]) {
    it(`keeps parsed header and Merkle bytes stable after offset-${offset} Buffer input changes`, () => {
      const backing = Buffer.alloc(80 + offset + 7);
      const input = backing.subarray(offset, offset + 80);
      input.set(original.raw);
      const parsed = parseHeader(input);
      backing.fill(0);
      expect(parsed.raw).toEqual(original.raw);
      expect(parsed.merkleRoot).toEqual(original.raw.slice(36, 68));
      expect(doubleHash(parsed.raw)).toBe(parsed.hashHex);
      expect(parsed.hashHex).toBe(original.hashHex);
    });

    it(`keeps trusted evidence stable after offset-${offset} Buffer input changes`, () => {
      const backing = Buffer.alloc(80 + offset + 7);
      const input = backing.subarray(offset, offset + 80);
      input.set(original.raw);
      const parsed = checkTrustedHeader({ height: 42, hashHex: original.hashHex, raw: input });
      input.fill(0);
      expect(parsed.raw).toEqual(original.raw);
      expect(parsed.merkleRoot).toEqual(original.raw.slice(36, 68));
      expect(doubleHash(parsed.raw)).toBe(original.hashHex);
    });
  }

  it('also isolates a shared-buffer input before deriving header identity and fields', () => {
    const input = new Uint8Array(new SharedArrayBuffer(80));
    input.set(original.raw);
    const parsed = parseHeader(input);
    const trusted = checkTrustedHeader({ height: 42, hashHex: original.hashHex, raw: input });
    input.fill(0);
    expect(parsed.raw).toEqual(original.raw);
    expect(parsed.merkleRoot).toEqual(original.raw.slice(36, 68));
    expect(doubleHash(parsed.raw)).toBe(original.hashHex);
    expect(trusted.raw).toEqual(original.raw);
    expect(trusted.merkleRoot).toEqual(original.raw.slice(36, 68));
  });
});
