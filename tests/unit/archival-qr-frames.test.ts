import { describe, expect, it } from 'vitest';
import { encodeReceiptFrames, recoverReceiptFrames } from '../../src/core/archive/frames';

const receipt = (size: number): Uint8Array => Uint8Array.from({ length: size }, (_, i) => (i * 31 + 7) & 255);

describe('UNALTERED-OTS-QR/1 transport', () => {
  it('round-trips one and multiple binary frames without changing receipt bytes', async () => {
    for (const size of [1, 32, 128, 1025, 4097]) {
      const input = receipt(size);
      const frames = await encodeReceiptFrames(input, 160);
      const recovered = await recoverReceiptFrames([...frames].reverse());
      expect(recovered).toEqual(input);
      expect(frames[0]!.subarray(0, 8)).toEqual(new TextEncoder().encode('UOTSQR01'));
    }
  });
  it('rejects missing, conflicting, corrupted and cross-proof frames', async () => {
    const frames = await encodeReceiptFrames(receipt(400), 160);
    await expect(recoverReceiptFrames(frames.slice(1))).rejects.toThrow();
    const tampered = frames.map((frame) => frame.slice());
    tampered[0]![tampered[0]!.length - 1] ^= 1;
    await expect(recoverReceiptFrames(tampered)).rejects.toThrow();
    const other = await encodeReceiptFrames(receipt(401), 160);
    await expect(recoverReceiptFrames([frames[0]!, other[1]!])).rejects.toThrow();
  });
  it('rejects unsupported versions and compression and invalid frame size', async () => {
    const [frame] = await encodeReceiptFrames(receipt(40), 160);
    const invalidVersion = frame!.slice(); invalidVersion[8] = 2;
    await expect(recoverReceiptFrames([invalidVersion])).rejects.toThrow();
    const invalidCompression = frame!.slice(); invalidCompression[10] = 1;
    await expect(recoverReceiptFrames([invalidCompression])).rejects.toThrow();
    await expect(encodeReceiptFrames(receipt(10), 80)).rejects.toThrow();
  });
});
