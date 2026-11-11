import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { cleanPng } from '../../src/core/strip/png';
import { chunk, makePng } from '../helpers/images';

// PNG3 table 7 (PLTE before tRNS), table 16 (sRGB intents 0..3), and section 13.5 (unknown reserved-bit chunks).
// Container tests only: compressed image bytes are copied unchanged, not decoded.
const withChunks = (...chunks: Uint8Array[]): Uint8Array => {
  const png = makePng();
  return concat(png.subarray(0, 33), ...chunks, png.subarray(33));
};

describe('PNG retained ancillary chunk guards', () => {
  for (const intent of [4, 5, 127, 128, 255]) {
    it(`rejects undefined sRGB rendering intent ${intent}`, () => {
      expect(cleanPng(withChunks(chunk('sRGB', Uint8Array.of(intent)))).kind).toBe('rejected');
    });
  }
  it('preserves every defined sRGB rendering intent byte-for-byte', () => {
    for (const intent of [0, 1, 2, 3]) {
      const input = withChunks(chunk('sRGB', Uint8Array.of(intent)));
      const result = cleanPng(input);
      expect(result.kind).toBe('cleaned');
      if (result.kind === 'cleaned') expect(result.output).toEqual(input);
    }
  });
  it('rejects a truecolor suggested palette after its transparency chunk', () => {
    const palette = chunk('PLTE', Uint8Array.of(0, 0, 0));
    const transparency = chunk('tRNS', new Uint8Array(6));
    expect(cleanPng(withChunks(transparency, palette)).kind).toBe('rejected');
  });
  it('keeps a correctly ordered suggested palette and truecolor transparency unchanged', () => {
    const input = withChunks(chunk('sRGB', Uint8Array.of(3)), chunk('PLTE', Uint8Array.of(0, 0, 0)), chunk('tRNS', new Uint8Array(6)));
    const result = cleanPng(input);
    expect(result.kind).toBe('cleaned');
    if (result.kind === 'cleaned') expect(result.output).toEqual(input);
  });
  it('drops an unknown ancillary chunk with its reserved bit set rather than retaining it', () => {
    const result = cleanPng(withChunks(chunk('prvt', Uint8Array.of(11, 22, 33))));
    expect(result.kind).toBe('cleaned');
    if (result.kind === 'cleaned') expect(result.output).toEqual(makePng());
  });
  it('still refuses unknown critical chunks when the reserved bit is set', () => {
    expect(cleanPng(withChunks(chunk('PRvt', Uint8Array.of(11, 22, 33)))).kind).toBe('rejected');
  });
});
