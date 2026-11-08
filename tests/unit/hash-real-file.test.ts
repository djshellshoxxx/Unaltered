import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { CHUNK_SIZE, hashSource, type ChunkSource } from '../../src/core/hash/stream';

// Genuine descriptor-backed reads, separate from the virtual-memory and browser File acceptance gates. Sparse
// zero-filled fixtures with markers keep disk use bounded. This establishes addressing/digest correctness, not disk speed.
it.runIf(process.env.UNALTERED_REAL_FILES === '1')('hashes real files through 2 GiB + 1 with bounded reads and cancellation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'unaltered-real-hash-'));
  const path = join(directory, 'synthetic.bin');
  const evidence: { size: number; maxRead: number; peakExtraRss: number; milliseconds: number; hex: string }[] = [];
  try {
    for (const size of [0, 1024 ** 2, CHUNK_SIZE - 1, CHUNK_SIZE, CHUNK_SIZE + 1, 100 * 1024 ** 2, 1024 ** 3, 2 * 1024 ** 3, 2 * 1024 ** 3 + 1]) {
      const file = await open(path, 'w+');
      try {
        await file.truncate(size);
        if (size > 0) {
          await file.write(Uint8Array.of(0x51), 0, 1, 0);
          await file.write(Uint8Array.of(0xa7), 0, 1, size - 1);
        }
        let maxRead = 0;
        const source: ChunkSource = { size, slice: (start, end) => ({ arrayBuffer: async () => {
          maxRead = Math.max(maxRead, end - start);
          const bytes = new Uint8Array(end - start);
          let offset = 0;
          while (offset < bytes.length) {
            const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, start + offset);
            if (bytesRead === 0) throw new Error('Synthetic file unexpectedly truncated');
            offset += bytesRead;
          }
          return bytes.buffer;
        } }) };
        if (size === 100 * 1024 ** 2) {
          const controller = new AbortController();
          const cancelled = await hashSource(source, { signal: controller.signal, onProgress: () => controller.abort() });
          expect(cancelled).toBeNull();
        }
        const baseline = process.memoryUsage().rss;
        let peakExtraRss = 0;
        let previous = 0;
        const started = performance.now();
        const result = await hashSource(source, { onProgress: (done) => {
          expect(done).toBeGreaterThan(previous);
          previous = done;
          peakExtraRss = Math.max(peakExtraRss, process.memoryUsage().rss - baseline);
        } });
        const independent = createHash('sha256');
        for await (const bytes of createReadStream(path, { highWaterMark: 1024 ** 2 })) independent.update(bytes);
        expect(result?.hex).toBe(independent.digest('hex'));
        expect(result?.bytes).toBe(size);
        expect(maxRead).toBeLessThanOrEqual(CHUNK_SIZE);
        expect(peakExtraRss).toBeLessThan(200 * 1024 ** 2);
        evidence.push({ size, maxRead, peakExtraRss, milliseconds: Math.round(performance.now() - started), hex: result!.hex });
      } finally { await file.close(); }
    }
    console.info(`real-file-hash-evidence=${JSON.stringify(evidence)}`);
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 600_000);
