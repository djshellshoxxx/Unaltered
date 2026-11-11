import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { cleanPng, selfCheckPng } from '../../src/core/strip/png';
import { chunk, makePng } from '../helpers/images';

// Structural validation only: IDAT remains compressed; these tests make no claim to decode its pixels.
const fixture = (header: Uint8Array, palette = false): Uint8Array => {
  const png = makePng();
  return concat(png.subarray(0, 8), chunk('IHDR', header), ...(palette ? [chunk('PLTE', Uint8Array.of(0, 0, 0))] : []), png.subarray(33));
};
const header = (): Uint8Array => Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0);

describe('PNG structural header guards (PNG 11.2.2)', () => {
  for (const offset of [0, 4]) for (const value of [0, 0x80000000, 0xffffffff]) {
    it(`rejects invalid dimension ${offset}:${value}`, () => {
      const h = header();
      new DataView(h.buffer).setUint32(offset, value);
      expect(cleanPng(fixture(h)).kind).toBe('rejected');
    });
  }
  const legal: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  it('accepts every standard color/depth combination and rejects all other byte combinations', () => {
    for (let color = 0; color <= 7; color++) for (const depth of [0, 1, 2, 3, 4, 8, 16, 32, 255]) {
      const h = header(); h[8] = depth; h[9] = color;
      const valid = legal[color]?.includes(depth) ?? false;
      expect(cleanPng(fixture(h, color === 3)).kind, `${color}/${depth}`).toBe(valid ? 'cleaned' : 'rejected');
    }
  });
  for (const [offset, value] of [[10, 1], [11, 1], [12, 2], [12, 255]]) {
    it(`rejects unsupported encoding field ${offset}:${value}`, () => {
      const h = header(); h[offset!] = value!;
      expect(cleanPng(fixture(h)).kind).toBe('rejected');
    });
  }
  it('keeps Adam7 and maximum standard dimensions without allocating pixel storage', () => {
    const h = header(); h[12] = 1;
    new DataView(h.buffer).setUint32(0, 0x7fffffff);
    expect(cleanPng(fixture(h)).kind).toBe('cleaned');
  });
  it('requires a palette for indexed image data', () => {
    const h = header(); h[9] = 3;
    expect(cleanPng(fixture(h)).kind).toBe('rejected');
  });
  it('bounds untrusted chunk lengths before the self-check reads a CRC', () => {
    for (const length of [14, 0x7fffffff, 0xffffffff]) {
      const png = makePng();
      new DataView(png.buffer).setUint32(8, length);
      expect(() => selfCheckPng(png)).not.toThrow();
      expect(selfCheckPng(png)).not.toBeNull();
    }
  });
});
