// Regression: `FF 00` at a marker position is a stuffed data byte to a JPEG decoder, which then resynchronises on the
// next real marker. The dimension gate used to read it as a length-prefixed segment and skip it, so a frame header
// hidden inside that "segment" was decoded by the browser while the gate read a later, small decoy frame. Confirmed in
// Chromium on 2026-11-11: a crafted 2854-byte file decoded as 7000x32 while the gate reported 64x64.
import { expect, it } from 'vitest';
import { qrImageDimensions } from '../../src/core/archive/qr-image';

const sof0 = (width: number, height: number): number[] =>
  [0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0];

it('rejects a stuffed FF 00 at a marker position instead of skipping it as a segment', () => {
  const hidden = sof0(9000, 9000);
  const crafted = Uint8Array.from([0xff, 0xd8, 0xff, 0x00, 0, hidden.length + 2, ...hidden, ...sof0(64, 64), 0xff, 0xd9]);
  expect(() => qrImageDimensions(crafted)).toThrow('Invalid JPEG marker');
});

it('still reads the first frame header of an ordinary JPEG with an APP0 segment', () => {
  const app0 = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const jpeg = Uint8Array.from([0xff, 0xd8, ...app0, ...sof0(640, 480), 0xff, 0xd9]);
  expect(qrImageDimensions(jpeg)).toEqual({ width: 640, height: 480 });
});
