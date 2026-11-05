import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { concat } from '../../src/core/bytes';
import { stripMetadata } from '../../src/core/strip';
import { cleanPng, selfCheckPng } from '../../src/core/strip/png';
import { chunk } from '../helpers/images';

// W3C PNG3 (2025-06-24), 11.3.1.1: decoders mask tRNS sample bits above the IHDR bit depth.
// https://www.w3.org/TR/2025/REC-png-3-20250624/#11tRNS
// Synthetic one-pixel images with valid zlib data. No real image or identifying content is used.
function png(depth: number, color: 0 | 2 | 3, transparency: Uint8Array): Uint8Array {
  const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const header = Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, depth, color, 0, 0, 0);
  const bytesPerPixel = color === 2 ? (depth === 16 ? 6 : 3) : depth === 16 ? 2 : 1;
  return concat(signature, chunk('IHDR', header),
    ...(color === 3 ? [chunk('PLTE', Uint8Array.of(0, 0, 0, 128, 128, 128, 255, 255, 255))] : []),
    chunk('tRNS', transparency), chunk('IDAT', deflateSync(new Uint8Array(1 + bytesPerPixel))), chunk('IEND'));
}

function cleaned(input: Uint8Array): Extract<ReturnType<typeof cleanPng>, { kind: 'cleaned' }> {
  const result = cleanPng(input);
  expect(result.kind).toBe('cleaned');
  if (result.kind !== 'cleaned') throw new Error('Synthetic PNG was not accepted');
  return result;
}

describe('PNG transparency bits that decoders ignore', () => {
  it('removes ignored truecolor high-byte payloads while preserving meaningful transparent samples', () => {
    const input = png(8, 2, Uint8Array.of(0x53, 11, 0x45, 22, 0x43, 33));
    const before = input.slice();
    const result = cleaned(input);
    expect(result.output).toEqual(png(8, 2, Uint8Array.of(0, 11, 0, 22, 0, 33)));
    expect(result.removed).toContain('Unused transparency sample bits (tRNS)');
    expect(input).toEqual(before);
    expect(selfCheckPng(result.output)).toBeNull();
    expect(cleaned(result.output)).toMatchObject({ output: result.output, removed: [] });
  });

  for (const depth of [1, 2, 4, 8]) {
    it(`removes all unused bits from a ${depth}-bit greyscale transparency value`, () => {
      const input = png(depth, 0, Uint8Array.of(0xff, 0xff));
      const result = cleaned(input);
      expect(result.output).toEqual(png(depth, 0, Uint8Array.of(0, 2 ** depth - 1)));
      expect(result.removed).toContain('Unused transparency sample bits (tRNS)');
    });
  }

  it('handles a PNG view whose backing buffer starts before the signature', () => {
    const input = png(8, 2, Uint8Array.of(0xde, 1, 0xad, 2, 0xbe, 3));
    const backing = concat(Uint8Array.of(1, 2, 3, 4, 5), input, Uint8Array.of(6, 7));
    const view = backing.subarray(5, 5 + input.length);
    expect(cleaned(view).output).toEqual(png(8, 2, Uint8Array.of(0, 1, 0, 2, 0, 3)));
  });

  it('preserves all meaningful 16-bit truecolor and greyscale transparency bytes', () => {
    for (const [color, samples] of [[0, Uint8Array.of(0xfe, 0xdc)], [2, Uint8Array.of(0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54)]] as const) {
      const input = png(16, color, samples);
      expect(cleaned(input)).toMatchObject({ output: input, removed: [] });
    }
  });

  it('preserves indexed transparency alpha bytes, which are all meaningful', () => {
    const input = png(8, 3, Uint8Array.of(0x53, 0x45, 0x43));
    expect(cleaned(input)).toMatchObject({ output: input, removed: [] });
  });

  it('returns normalized transparency through the public Blob cleaner', async () => {
    const input = png(8, 2, Uint8Array.of(0x53, 11, 0x45, 22, 0x43, 33));
    const result = await stripMetadata(new Blob([input as BlobPart]));
    expect(result.kind).toBe('cleaned');
    if (result.kind !== 'cleaned') throw new Error('Synthetic PNG was not accepted');
    expect(new Uint8Array(await result.output.arrayBuffer())).toEqual(png(8, 2, Uint8Array.of(0, 11, 0, 22, 0, 33)));
    expect(result.removed).toContain('Unused transparency sample bits (tRNS)');
  });
});
