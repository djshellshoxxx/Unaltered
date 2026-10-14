import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { groupHex } from '../../src/core/bytes';
import { hashBlob } from '../../src/core/hash/hasher';
import { hashSource } from '../../src/core/hash/stream';

interface Vec {
  name: string;
  input: { type: 'utf8' | 'repeat'; value: string; count?: number };
  sha256: string;
}
const vectors = (JSON.parse(readFileSync('tests/vectors/sha256.json', 'utf8')) as { vectors: Vec[] }).vectors;
const inputOf = (v: Vec): string => (v.input.type === 'repeat' ? v.input.value.repeat(v.input.count!) : v.input.value);

describe('FR-1 hashing', () => {
  for (const v of vectors) {
    it(`known answer: ${v.name}`, async () => {
      const r = await hashBlob(new Blob([inputOf(v)]), { noWorker: true });
      expect(r.hex).toBe(v.sha256);
      expect(r.bytes).toBe(inputOf(v).length);
    });
  }

  it('equals one-shot hash for arbitrary chunk sizes (property)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ maxLength: 5000 }), fc.integer({ min: 1, max: 700 }), async (data, chunk) => {
        const r = await hashSource(new Blob([data as BlobPart]), { chunkSize: chunk });
        expect(r!.hex).toBe(createHash('sha256').update(data).digest('hex'));
      }),
      { numRuns: 60 },
    );
  });

  it('reports progress and supports cancel', async () => {
    const seen: number[] = [];
    await hashSource(new Blob([new Uint8Array(100)]), { chunkSize: 30, onProgress: (n) => seen.push(n) });
    expect(seen).toEqual([30, 60, 90, 100]);
    const ac = new AbortController();
    ac.abort();
    await expect(hashBlob(new Blob(['x']), { signal: ac.signal, noWorker: true })).rejects.toMatchObject({ code: 'ABORTED' });
    let calls = 0;
    const r = await hashSource(new Blob([new Uint8Array(100)]), { chunkSize: 10, isCancelled: () => ++calls > 2 });
    expect(r).toBeNull();
  });

  it('groups hex in blocks of 8 (FR-2)', () => {
    expect(groupHex('0123456789abcdef0123')).toBe('01234567 89abcdef 0123');
  });

  // FR-1 acceptance: 2 GiB with bounded memory. Opt-in because it takes a while: UNALTERED_BIG=1 npm test
  it.runIf(process.env.UNALTERED_BIG === '1')('hashes a virtual 2 GiB source with <200 MiB extra memory', async () => {
    const size = 2 * 1024 ** 3;
    const piece = new Uint8Array(4 * 1024 * 1024).fill(0x61);
    const src = { size, slice: (a: number, b: number) => ({ arrayBuffer: async () => piece.slice(0, b - a).buffer as ArrayBuffer }) };
    const before = process.memoryUsage().rss;
    let peak = 0;
    const r = await hashSource(src, { onProgress: () => (peak = Math.max(peak, process.memoryUsage().rss - before)) });
    const h = createHash('sha256');
    for (let i = 0; i < size / piece.length; i++) h.update(piece);
    expect(r!.hex).toBe(h.digest('hex'));
    expect(peak).toBeLessThan(200 * 1024 * 1024);
  }, 600_000);
});
