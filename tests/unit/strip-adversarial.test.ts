// Adversarial parser review 2026-11-04: each block reproduces a defect on 583aca4 and guards its fix.
import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { cleanMp3 } from '../../src/core/strip/audio';
import { cleanPng } from '../../src/core/strip/png';
import { apeTag, FRAME } from '../helpers/audio';
import { chunk, contains } from '../helpers/images';

const frame = (fill: number): number[] => {
  const f = [...FRAME];
  f.fill(fill, 4);
  return f;
};

describe('MP3: an APEv2 footer cannot claim complete audio frames as tag bytes', () => {
  const [a, b] = [frame(0x11), frame(0x22)];

  it('rejects a footer size that reaches back over the last audio frame', () => {
    const tag = apeTag([['Artist', 'SECRET-APE']], false);
    const input = Uint8Array.from([...a, ...b, ...tag]);
    const dv = new DataView(input.buffer);
    // Without a header the inflated "items" region would begin exactly at frame b.
    dv.setUint32(input.length - 20, dv.getUint32(input.length - 20, true) + b.length, true);
    const r = cleanMp3(input);
    expect(r.kind === 'cleaned' ? [...r.output] : r.kind).toBe('rejected');
  });

  it('rejects a header flag when no APE header is where the footer says', () => {
    const tag = apeTag([['Artist', 'SECRET-APE']], false);
    const input = Uint8Array.from([...a, ...b, ...tag]);
    const dv = new DataView(input.buffer);
    // The flag adds 32 header bytes; together with the adjusted size the tag would start at frame b.
    dv.setUint32(input.length - 20, dv.getUint32(input.length - 20, true) + b.length - 32, true);
    dv.setUint32(input.length - 12, 0x80000000, true);
    const r = cleanMp3(input);
    expect(r.kind === 'cleaned' ? [...r.output] : r.kind).toBe('rejected');
  });

  it('still removes well-formed APE tags with and without a header', () => {
    for (const header of [true, false]) {
      const r = cleanMp3(Uint8Array.from([...a, ...b, ...apeTag([['Artist', 'SECRET-APE'], ['Cover Art (Front)', '\x01\x02']], header)]));
      if (r.kind !== 'cleaned') throw new Error(`header=${header}: ${JSON.stringify(r)}`);
      expect([...r.output]).toEqual([...a, ...b]);
      expect(r.removed).toEqual(['APEv2 tag']);
    }
  });
});

describe('PNG: PLTE/tRNS bytes that the colour type cannot use are refused, not kept', () => {
  const be32 = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  const sig = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const idat = Uint8Array.of(0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01);
  const png = (bitDepth: number, colorType: number, ...beforeIdat: Uint8Array[]): Uint8Array =>
    concat(sig, chunk('IHDR', concat(be32(1), be32(1), Uint8Array.of(bitDepth, colorType, 0, 0, 0))), ...beforeIdat, chunk('IDAT', idat), chunk('IEND'));
  const secret = (n: number): Uint8Array => new TextEncoder().encode('SECRET-'.repeat(40)).subarray(0, n);

  it('rejects ignored palette or transparency bytes', () => {
    for (const [label, input] of [
      ['PLTE in a greyscale image', png(8, 0, chunk('PLTE', secret(45)))],
      ['PLTE in a greyscale+alpha image', png(8, 4, chunk('PLTE', secret(45)))],
      ['more palette entries than a 1-bit index addresses', png(1, 3, chunk('PLTE', secret(45)))],
      ['indexed tRNS before PLTE', png(8, 3, chunk('tRNS', secret(20)), chunk('PLTE', secret(6)))],
      ['indexed tRNS longer than the palette', png(8, 3, chunk('PLTE', secret(6)), chunk('tRNS', secret(20)))],
      ['greyscale tRNS of the wrong size', png(8, 0, chunk('tRNS', secret(1)))],
    ] as const) {
      const r = cleanPng(input);
      expect(r.kind === 'cleaned' ? `cleaned, secret kept: ${contains(r.output, 'SECRET')}` : r.kind, label).toBe('rejected');
    }
  });

  it('keeps valid palettes and transparency', () => {
    for (const input of [
      png(8, 3, chunk('PLTE', secret(6)), chunk('tRNS', secret(2))),
      png(1, 3, chunk('PLTE', secret(6))),
      png(8, 2, chunk('PLTE', secret(6)), chunk('tRNS', secret(6))), // suggested palette for truecolour is allowed
      png(16, 0, chunk('tRNS', secret(2))),
    ]) expect(cleanPng(input).kind).toBe('cleaned');
  });
});
