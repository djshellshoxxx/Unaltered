import { expect, it } from 'vitest';
import { qrImageDimensions } from '../../src/core/archive/qr-image';
it('reads PNG dimensions and rejects oversized images before browser decoding', () => {
  const bytes = new Uint8Array(33); bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const view = new DataView(bytes.buffer); view.setUint32(16, 740); view.setUint32(20, 740);
  expect(qrImageDimensions(bytes)).toEqual({ width: 740, height: 740 });
  view.setUint32(16, 100_000);
  expect(() => qrImageDimensions(bytes)).toThrow();
  expect(() => qrImageDimensions(new Uint8Array(12))).toThrow();
});
it('reads JPEG frame dimensions but rejects truncated length fields', () => {
  const jpeg = Uint8Array.from([255,216,255,192,0,11,8,2,0,3,0,1,1,17,0,255,217]);
  expect(qrImageDimensions(jpeg)).toEqual({ width: 768, height: 512 });
  expect(() => qrImageDimensions(jpeg.slice(0,10))).toThrow();
});
