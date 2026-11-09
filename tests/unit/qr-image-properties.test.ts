import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { qrImageDimensions } from '../../src/core/archive/qr-image';

const seed = 20261110;
const dimensions = fc.integer({ min: 21, max: 6000 }).chain(width =>
  fc.integer({ min: 21, max: Math.min(6000, Math.floor(16_000_000 / width)) })
    .map(height => ({ width, height })));

// These synthetic headers test the pre-allocation dimension gate, not full
// image validity or native raster decoding. No real images or metadata are used.
function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  bytes[24] = 8; bytes[25] = 2;
  return bytes;
}

function jpegHeader(width: number, height: number, metadata: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(21 + metadata.length);
  bytes.set([255, 216, 255, 225]);
  const view = new DataView(bytes.buffer);
  view.setUint16(4, metadata.length + 2);
  bytes.set(metadata, 6);
  const frame = 6 + metadata.length;
  bytes.set([255, 192, 0, 11, 8, 0, 0, 0, 0, 1, 1, 17, 0, 255, 217], frame);
  view.setUint16(frame + 5, height); view.setUint16(frame + 7, width);
  return bytes;
}

describe('QR image header properties', () => {
  it('reads bounded PNG and JPEG dimensions independently of JPEG metadata contents', () => {
    fc.assert(fc.property(dimensions, fc.uint8Array({ maxLength: 128 }), ({ width, height }, metadata) => {
      expect(qrImageDimensions(pngHeader(width, height))).toEqual({ width, height });
      expect(qrImageDimensions(jpegHeader(width, height, metadata))).toEqual({ width, height });
    }), { seed, numRuns: 150 });
  });

  it('rejects dimensions outside the documented side and pixel budgets before image decoding', () => {
    const invalid = fc.oneof(
      fc.record({ width: fc.integer({ min: 0, max: 20 }), height: fc.integer({ min: 21, max: 6000 }) }),
      fc.record({ width: fc.integer({ min: 21, max: 6000 }), height: fc.integer({ min: 0, max: 20 }) }),
      fc.record({ width: fc.integer({ min: 6001, max: 65535 }), height: fc.integer({ min: 21, max: 6000 }) }),
      fc.record({ width: fc.integer({ min: 21, max: 6000 }), height: fc.integer({ min: 6001, max: 65535 }) }),
      fc.integer({ min: 4001, max: 6000 }).chain(width =>
        fc.integer({ min: Math.floor(16_000_000 / width) + 1, max: 6000 }).map(height => ({ width, height }))),
    );
    fc.assert(fc.property(invalid, ({ width, height }) => {
      expect(() => qrImageDimensions(pngHeader(width, height))).toThrow();
      expect(() => qrImageDimensions(jpegHeader(width, height, new Uint8Array()))).toThrow();
    }), { seed: seed + 1, numRuns: 150 });
  });

  it('rejects truncation anywhere before the complete required PNG or JPEG header', () => {
    fc.assert(fc.property(dimensions, fc.uint8Array({ maxLength: 128 }), fc.nat(),
      ({ width, height }, metadata, cut) => {
        const png = pngHeader(width, height);
        const jpeg = jpegHeader(width, height, metadata);
        expect(() => qrImageDimensions(png.slice(0, cut % png.length))).toThrow();
        // The final EOI marker is not part of the dimension gate; cut before the SOF ends.
        expect(() => qrImageDimensions(jpeg.slice(0, cut % (jpeg.length - 2)))).toThrow();
      }), { seed: seed + 2, numRuns: 200 });
  });

  it('rejects corrupted PNG IHDR lengths and truncated JPEG segment declarations', () => {
    fc.assert(fc.property(
      dimensions, fc.uint8Array({ maxLength: 128 }),
      fc.integer({ min: 0, max: 65535 }).filter(length => length !== 13),
      fc.integer({ min: 1, max: 1024 }),
      ({ width, height }, metadata, ihdrLength, excess) => {
        const png = pngHeader(width, height);
        new DataView(png.buffer).setUint32(8, ihdrLength);
        expect(() => qrImageDimensions(png)).toThrow();
        for (const offset of [4, 8 + metadata.length]) {
          const jpeg = jpegHeader(width, height, metadata);
          new DataView(jpeg.buffer).setUint16(offset, jpeg.length + excess);
          expect(() => qrImageDimensions(jpeg)).toThrow();
        }
      },
    ), { seed: seed + 3, numRuns: 150 });
  });

  it('rejects JPEG segment lengths too short to contain their required fields', () => {
    fc.assert(fc.property(dimensions, fc.integer({ min: 0, max: 7 }), ({ width, height }, length) => {
      const jpeg = jpegHeader(width, height, new Uint8Array());
      new DataView(jpeg.buffer).setUint16(8, length);
      expect(() => qrImageDimensions(jpeg)).toThrow();
      for (const appLength of [0, 1]) {
        const invalidApp = jpegHeader(width, height, new Uint8Array());
        new DataView(invalidApp.buffer).setUint16(4, appLength);
        expect(() => qrImageDimensions(invalidApp)).toThrow();
      }
    }), { seed: seed + 4, numRuns: 80 });
  });
});
