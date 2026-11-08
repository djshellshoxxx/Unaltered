import { describe, expect, it } from 'vitest';
import { decodeRasterFrames } from '../../src/core/archive/qr-decode';
import { encodeArchivalQr } from '../../src/core/archive/qr-encode';
import { recoverReceiptFrames } from '../../src/core/archive/frames';
import { qrRaster } from '../helpers/qr-raster';

const receipt = Uint8Array.from({ length: 1800 }, (_, i) => (i * 31) & 255);
describe('independent binary QR image recovery', () => {
  it.each(['L','M','Q','H'] as const)('recovers every byte at ECC %s from pixels rather than retained frames', async preference => {
    const { symbols } = await encodeArchivalQr(receipt, { preference });
    const decoded = symbols.flatMap(symbol => { const image = qrRaster(symbol); return decodeRasterFrames(image.data, image.width, image.height); });
    expect(decoded).toHaveLength(symbols.length);
    expect(await recoverReceiptFrames(decoded.reverse())).toEqual(receipt);
  });
  it('finds multiple symbols on one scanned page without editing the input pixels', async () => {
    const { symbols } = await encodeArchivalQr(receipt, { preference: 'H' });
    expect(symbols.length).toBeGreaterThan(1);
    const a = qrRaster(symbols[0]!); const b = qrRaster(symbols[1]!);
    const width = a.width + b.width + 64; const height = Math.max(a.height, b.height);
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (let row = 0; row < height; row++) {
      if (row < a.height) data.set(a.data.subarray(row * a.width * 4, (row + 1) * a.width * 4), row * width * 4);
      if (row < b.height) data.set(b.data.subarray(row * b.width * 4, (row + 1) * b.width * 4), (row * width + a.width + 64) * 4);
    }
    const before = data.slice();
    expect(decodeRasterFrames(data, width, height)).toEqual([symbols[0]!.frame, symbols[1]!.frame]);
    expect(Buffer.compare(Buffer.from(data), Buffer.from(before))).toBe(0);
  });
  it('decodes a quarter-turn scan and rejects impossible raster sizes before allocation', async () => {
    const { symbols } = await encodeArchivalQr(Uint8Array.from([0,255,128,1,200]));
    const image = qrRaster(symbols[0]!); const rotated = new Uint8ClampedArray(image.data.length);
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      rotated.set(image.data.subarray((y * image.width + x) * 4, (y * image.width + x + 1) * 4), (x * image.width + image.width - 1 - y) * 4);
    }
    expect(decodeRasterFrames(rotated, image.width, image.height)).toEqual([symbols[0]!.frame]);
    expect(() => decodeRasterFrames(new Uint8ClampedArray(4), 100_000, 100_000)).toThrow();
    expect(() => decodeRasterFrames(image.data, NaN, image.height)).toThrow();
  });
});

it('never combines pixels from different receipts into a recovered proof', async () => {
  const first = await encodeArchivalQr(receipt, { preference: 'H' });
  const changed = receipt.slice(); changed[0] = 99;
  const second = await encodeArchivalQr(changed, { preference: 'H' });
  const scanned = [first.symbols[0]!, second.symbols[1]!].flatMap(symbol => {
    const image = qrRaster(symbol); return decodeRasterFrames(image.data, image.width, image.height);
  });
  await expect(recoverReceiptFrames(scanned)).rejects.toThrow();
  const image = qrRaster(first.symbols[0]!);
  await expect(recoverReceiptFrames(decodeRasterFrames(image.data, image.width, image.height))).rejects.toThrow();
});
