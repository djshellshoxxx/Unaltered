// Regression: frame recovery must check that payload lengths add up to the declared receipt length before it allocates
// the receipt buffer, so a single tiny forged frame cannot force a transient 16 MiB allocation (found by fuzz
// workstream C, docs/evidence/fuzz-20261111.json notes).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeReceiptFrames, recoverReceiptFrames } from '../../src/core/archive/frames';

const BIG = 1024 * 1024;

/** Re-declares a frame's original and encoded receipt length (header offsets 36 and 40). */
function declareLength(frame: Uint8Array, length: number): Uint8Array {
  const forged = frame.slice();
  const view = new DataView(forged.buffer);
  view.setUint32(36, length);
  view.setUint32(40, length);
  return forged;
}

function countLargeAllocations(): { count: () => number } {
  const Real = Uint8Array;
  let large = 0;
  const Counting = new Proxy(Real, {
    construct(target, args: unknown[]) {
      if (typeof args[0] === 'number' && args[0] >= BIG) large++;
      return Reflect.construct(target, args) as object;
    },
  });
  vi.stubGlobal('Uint8Array', Counting);
  return { count: () => large };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('archival frame recovery allocation bound', () => {
  it('rejects a short payload declaring 16 MiB without allocating the declared length', async () => {
    const [frame] = await encodeReceiptFrames(Uint8Array.from([1, 2, 3, 4, 5]), 160);
    const forged = declareLength(frame!, 16 * 1024 * 1024);
    const spy = countLargeAllocations();
    await expect(recoverReceiptFrames([forged])).rejects.toThrow('Invalid archival QR frame: receipt checksum');
    expect(spy.count()).toBe(0);
  });

  it('keeps the partition error when payloads exceed the declared length', async () => {
    const frames = await encodeReceiptFrames(Uint8Array.from({ length: 300 }, (_, i) => i & 255), 160);
    const forged = frames.map((f) => declareLength(f, 10));
    await expect(recoverReceiptFrames(forged)).rejects.toThrow('Invalid archival QR frame: invalid partition');
  });

  it('still recovers a genuine multi-frame receipt', async () => {
    const input = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) & 255);
    const frames = await encodeReceiptFrames(input, 160);
    expect(await recoverReceiptFrames(frames)).toEqual(input);
  });
});
