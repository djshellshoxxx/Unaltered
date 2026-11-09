import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeReceiptFrames, recoverReceiptFrames } from '../../src/core/archive/frames';

const seed = 20261109;
const receiptBytes = fc.uint8Array({ minLength: 1, maxLength: 2048 });
// Every generated case has at least two frames, so removing or replacing one
// exercises a partial receipt rather than only the empty-input guard.
const multipart = fc.uint8Array({ minLength: 2, maxLength: 1024 }).chain(receipt =>
  fc.integer({ min: 81, max: 80 + Math.min(256, receipt.length - 1) })
    .map(capacity => ({ receipt, capacity })));

describe('archival frame transport properties', () => {
  it('preserves arbitrary binary receipts through reordered and identical duplicate frames', async () => {
    await fc.assert(fc.asyncProperty(
      receiptBytes,
      fc.integer({ min: 112, max: 2953 }),
      fc.array(fc.integer(), { minLength: 64, maxLength: 64 }),
      fc.nat(),
      async (receipt, capacity, priorities, duplicateIndex) => {
        const frames = await encodeReceiptFrames(receipt, capacity);
        const reordered = frames.map((frame, index) => ({ frame, priority: priorities[index]! }))
          .sort((a, b) => a.priority - b.priority).map(({ frame }) => frame);
        const duplicate = frames[duplicateIndex % frames.length]!.slice();
        expect(await recoverReceiptFrames([duplicate, ...reordered, duplicate.slice()])).toEqual(receipt);
      },
    ), { seed, numRuns: 100 });
  });

  it('rejects a missing frame at any position of a multipart receipt', async () => {
    await fc.assert(fc.asyncProperty(multipart, fc.nat(), async ({ receipt, capacity }, removed) => {
      const frames = await encodeReceiptFrames(receipt, capacity);
      const incomplete = frames.filter((_, index) => index !== removed % frames.length);
      await expect(recoverReceiptFrames(incomplete)).rejects.toThrow();
    }), { seed: seed + 1, numRuns: 80 });
  });

  it('rejects payload corruption and conflicting duplicates even when lengths remain valid', async () => {
    await fc.assert(fc.asyncProperty(
      receiptBytes, fc.nat(), fc.nat(), fc.integer({ min: 0, max: 7 }),
      async (receipt, selected, payloadOffset, bit) => {
        const frames = await encodeReceiptFrames(receipt, 256);
        const index = selected % frames.length;
        const corrupt = frames[index]!.slice();
        const offset = 80 + payloadOffset % (corrupt.length - 80);
        corrupt[offset] = corrupt[offset]! ^ (1 << bit);
        const replaced = frames.map((frame, at) => at === index ? corrupt : frame);
        await expect(recoverReceiptFrames(replaced)).rejects.toThrow();
        await expect(recoverReceiptFrames([...frames, corrupt])).rejects.toThrow();
      },
    ), { seed: seed + 2, numRuns: 80 });
  });

  it('rejects single-bit mutations anywhere in a frame header', async () => {
    await fc.assert(fc.asyncProperty(
      receiptBytes, fc.nat(), fc.integer({ min: 0, max: 79 }), fc.integer({ min: 0, max: 7 }),
      async (receipt, selected, offset, bit) => {
        const frames = await encodeReceiptFrames(receipt, 256);
        const index = selected % frames.length;
        const corrupt = frames[index]!.slice();
        corrupt[offset] = corrupt[offset]! ^ (1 << bit);
        await expect(recoverReceiptFrames(frames.map((frame, at) => at === index ? corrupt : frame)))
          .rejects.toThrow();
      },
    ), { seed: seed + 3, numRuns: 120 });
  });

  it('never assembles receipts from two different frame sets of the same dimensions', async () => {
    await fc.assert(fc.asyncProperty(multipart, fc.nat(), async ({ receipt, capacity }, selected) => {
      const other = receipt.slice();
      other[0] = other[0]! ^ 1;
      const frames = await encodeReceiptFrames(receipt, capacity);
      const foreign = await encodeReceiptFrames(other, capacity);
      const index = selected % frames.length;
      await expect(recoverReceiptFrames(frames.map((frame, at) => at === index ? foreign[index]! : frame)))
        .rejects.toThrow();
      await expect(recoverReceiptFrames([...frames, ...foreign])).rejects.toThrow();
    }), { seed: seed + 4, numRuns: 80 });
  });
});
