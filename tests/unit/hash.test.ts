import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { groupHex } from '../../src/core/bytes';
import { hashBlob } from '../../src/core/hash/hasher';
import { CANCEL_SETTLE_MS, hashSource } from '../../src/core/hash/stream';

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

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 0.5])(
    'rejects invalid stall timeout %s before opening a stream',
    async (stallMs) => {
      let opened = false;
      const src = {
        size: 3,
        slice: (): never => { throw new Error('unexpected fallback read'); },
        stream: (): ReadableStream<Uint8Array> => {
          opened = true;
          return new Blob(['abc']).stream();
        },
      };
      await expect(hashSource(src, { stallMs })).rejects.toMatchObject({ code: 'INPUT_INVALID' });
      expect(opened).toBe(false);
    },
  );

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
  it('hashes a byte stream without allocating Blob slices', async () => {
    const blob = new Blob(['abc']);
    const src = { size: blob.size, stream: () => blob.stream(), slice: (): never => { throw new Error('unexpected slice allocation'); } };
    const result = await hashSource(src, { chunkSize: 2 });
    expect(result!.hex).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('streams real Blobs through bounded slices without starting a whole-file stream or allocating slice buffers', async () => {
    const blob = new Blob([new Uint8Array(9000).fill(7)]);
    const slice = blob.slice.bind(blob);
    let slices = 0;
    blob.stream = (): never => { throw new Error('whole-file stream started'); };
    blob.slice = (start = 0, end = blob.size): Blob => {
      expect(end - start).toBeLessThanOrEqual(1024);
      slices++;
      const part = slice(start, end);
      part.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('slice buffer allocated instead of BYOB'); };
      return part;
    };
    const result = await hashSource(blob, { chunkSize: 1024 });
    expect(result!.hex).toBe(createHash('sha256').update(new Uint8Array(9000).fill(7)).digest('hex'));
    expect(slices).toBeGreaterThan(1);
  });
  it('cross-checks a file without asking its backend for a whole-file ArrayBuffer', async () => {
    const bytes = new Uint8Array(9 * 1024 * 1024).fill(3);
    const blob = new Blob([bytes]);
    const slice = blob.slice.bind(blob);
    blob.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('whole-file backend read'); };
    blob.slice = (start = 0, end = blob.size): Blob => {
      expect(end - start).toBeLessThanOrEqual(4 * 1024 * 1024);
      return slice(start, end);
    };
    const result = await hashBlob(blob, { noWorker: true });
    expect(result.hex).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
  it('observes normal slice EOF before opening another reader over a shared backend', async () => {
    // A lifecycle model: cancellation settles, but premature cancellation poisons a later read.
    // This establishes the sequence's behavior, not the cause of a native browser stall.
    const bytes = Uint8Array.of(1, 2, 3, 4, 5, 6, 7);
    const blob = new Blob([bytes]);
    const slice = blob.slice.bind(blob);
    const ranges: number[][] = [];
    const streams: ReadableStream<Uint8Array>[] = [];
    const progress: number[] = [];
    let poisoned = false;
    let cancels = 0;
    let normalEofs = 0;
    blob.slice = (start = 0, end = blob.size): Blob => {
      ranges.push([start, end]);
      const part = slice(start, end);
      let offset = start;
      let sawEof = false;
      const stream = new ReadableStream({ type: 'bytes', pull(controller) {
        if (poisoned) return new Promise<void>(() => {});
        const request = controller.byobRequest;
        if (!request?.view) throw new Error('expected a BYOB request');
        if (offset === end) {
          sawEof = true;
          normalEofs++;
          controller.close();
          request.respond(0);
          return;
        }
        const view = new Uint8Array(request.view.buffer, request.view.byteOffset, request.view.byteLength);
        const length = Math.min(view.length, end - offset);
        view.set(bytes.subarray(offset, offset + length));
        offset += length;
        request.respond(length);
      }, cancel() {
        cancels++;
        if (!sawEof) poisoned = true;
        // Resolves normally; the next reader, rather than this cancellation, is blocked.
      } });
      streams.push(stream);
      part.stream = () => stream;
      part.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('unexpected allocated slice read'); };
      return part;
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([hashSource(blob, { chunkSize: 3, onProgress: (done) => progress.push(done) }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Slice lifecycle did not settle: progress=${progress.join(',')}; cancels=${cancels}; normalEofs=${normalEofs}; poisoned=${poisoned}; slices=${JSON.stringify(ranges)}`)), 1000);
        })]);
      expect(result?.hex).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(result?.bytes).toBe(bytes.length);
      expect(ranges).toEqual([[0, 3], [3, 6], [6, 7]]);
      expect(progress).toEqual([3, 6, 7]);
      expect(normalEofs).toBe(3);
      expect(poisoned).toBe(false);
      expect(streams.every((stream) => !stream.locked)).toBe(true);
    } finally { clearTimeout(timer); }
  });
  describe('a slice read that stops delivering data (native read stall)', () => {
    // hangs(start, attempt, phase) decides whether a slice stream for [start, end) stalls on its Nth open.
    function stallingBlob(bytes: Uint8Array, hangs: (start: number, attempt: number, phase: 'data' | 'eof') => boolean) {
      const blob = new Blob([bytes as BlobPart]);
      const slice = blob.slice.bind(blob);
      const opens = new Map<number, number>();
      const ranges: number[][] = [];
      let cancels = 0;
      blob.slice = (start = 0, end = blob.size): Blob => {
        ranges.push([start, end]);
        const attempt = (opens.get(start) ?? 0) + 1;
        opens.set(start, attempt);
        const part = slice(start, end);
        let offset = start;
        part.stream = () => new ReadableStream({ type: 'bytes', pull(controller) {
          const request = controller.byobRequest!;
          if (hangs(start, attempt, offset === end ? 'eof' : 'data')) return new Promise<void>(() => {});
          if (offset === end) {
            controller.close();
            request.respond(0);
            return;
          }
          const view = new Uint8Array(request.view!.buffer, request.view!.byteOffset, request.view!.byteLength);
          const length = Math.min(view.length, end - offset);
          view.set(bytes.subarray(offset, offset + length));
          offset += length;
          request.respond(length);
        }, cancel() {
          cancels++;
          return new Promise<void>(() => {}); // A cancellation that never settles must not be awaited.
        } });
        part.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('unexpected allocated slice read'); };
        return part;
      };
      return { blob, ranges, cancels: () => cancels };
    }
    const bytes = Uint8Array.from({ length: 7 }, (_, i) => i + 1);
    const expected = createHash('sha256').update(bytes).digest('hex');

    it('reopens a stalled slice and hashes every byte exactly once', async () => {
      const f = stallingBlob(bytes, (start, attempt, phase) => start === 3 && attempt === 1 && phase === 'data');
      const progress: number[] = [];
      const result = await hashSource(f.blob, { chunkSize: 3, stallMs: 20, onProgress: (n) => progress.push(n) });
      expect(result!.hex).toBe(expected);
      expect(f.ranges).toEqual([[0, 3], [3, 6], [3, 6], [6, 7]]);
      expect(progress).toEqual([3, 6, 7]);
      expect(f.cancels()).toBe(1);
    });
    it('continues after a stalled end-of-slice check without re-reading delivered bytes', async () => {
      const f = stallingBlob(bytes, (start, attempt, phase) => start === 0 && attempt === 1 && phase === 'eof');
      const result = await hashSource(f.blob, { chunkSize: 3, stallMs: 20 });
      expect(result!.hex).toBe(expected);
      expect(f.ranges).toEqual([[0, 3], [3, 6], [6, 7]]);
    });
    it('does not treat a slow but steadily delivering slice as a stall (progress-based timeout)', async () => {
      // One byte per pull, each well under stallMs, but a whole 3-byte region takes longer than stallMs.
      // Drive this synthetic backend with fake time so host scheduling cannot turn progress into a false stall.
      vi.useFakeTimers();
      const started = Date.now();
      const deliveredAt: number[] = [];
      const blob = new Blob([bytes as BlobPart]);
      const slice = blob.slice.bind(blob);
      const ranges: number[][] = [];
      blob.slice = (start = 0, end = blob.size): Blob => {
        ranges.push([start, end]);
        const part = slice(start, end);
        let offset = start;
        part.stream = () => new ReadableStream({ type: 'bytes', async pull(controller) {
          const request = controller.byobRequest!;
          if (offset === end) {
            controller.close();
            request.respond(0);
            return;
          }
          await new Promise((r) => setTimeout(r, 15));
          new Uint8Array(request.view!.buffer, request.view!.byteOffset, 1)[0] = bytes[offset]!;
          offset += 1;
          deliveredAt.push(Date.now() - started);
          request.respond(1);
        } });
        return part;
      };
      const progress: number[] = [];
      try {
        const pending = hashSource(blob, { chunkSize: 3, stallMs: 30, onProgress: (n) => progress.push(n) });
        await vi.advanceTimersByTimeAsync(15 * bytes.length);
        const result = await pending;
        expect(result!.hex).toBe(expected);
        expect(ranges).toEqual([[0, 3], [3, 6], [6, 7]]);
        expect(progress).toEqual([3, 6, 7]);
        expect(deliveredAt).toEqual([15, 30, 45, 60, 75, 90, 105]);
        expect(deliveredAt[2]).toBeGreaterThan(30); // First 3-byte slice takes 45 ms without 30 ms of silence.
        expect(deliveredAt[5]! - deliveredAt[2]!).toBeGreaterThan(30);
        expect(vi.getTimerCount()).toBe(0);
      } finally { vi.useRealTimers(); }
    });
    it('fails with a typed error, instead of hanging, when a slice keeps stalling', async () => {
      const f = stallingBlob(bytes, (start, _attempt, phase) => start === 3 && phase === 'data');
      const started = Date.now();
      await expect(hashSource(f.blob, { chunkSize: 3, stallMs: 20 })).rejects.toMatchObject({ code: 'INPUT_UNREADABLE' });
      expect(Date.now() - started).toBeLessThan(2000);
      expect(f.ranges).toEqual([[0, 3], [3, 6], [3, 6], [3, 6]]);
    });
  });
  describe('stall recovery edge cases', () => {
    const bytes = Uint8Array.from({ length: 7 }, (_, i) => i + 1);
    const expected = createHash('sha256').update(bytes).digest('hex');
    // A slice stream whose first open for `slowStart` answers only after `delayMs` (later than the stall timeout).
    function lateBlob(slowStart: number, delayMs: number, neverCancel: boolean, opens = new Map<number, number>()) {
      const blob = new Blob([bytes as BlobPart]);
      const slice = blob.slice.bind(blob);
      blob.slice = (start = 0, end = blob.size): Blob => {
        const attempt = (opens.get(start) ?? 0) + 1;
        opens.set(start, attempt);
        const part = slice(start, end);
        let offset = start;
        part.stream = () => new ReadableStream({ type: 'bytes', async pull(controller) {
          const slow = start === slowStart && attempt === 1 && offset !== end;
          if (slow) await new Promise((r) => setTimeout(r, delayMs));
          let request: ReadableStreamBYOBRequest | null;
          try { request = controller.byobRequest; } catch { return; }
          if (!request) return;
          if (offset === end) { controller.close(); request.respond(0); return; }
          const view = new Uint8Array(request.view!.buffer, request.view!.byteOffset, request.view!.byteLength);
          const length = Math.min(view.length, end - offset);
          view.set(bytes.subarray(offset, offset + length));
          offset += length;
          request.respond(length);
        }, cancel() { return neverCancel ? new Promise<void>(() => {}) : undefined; } });
        part.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('unexpected allocated slice read'); };
        return part;
      };
      return blob;
    }
    // Delivers at most `step` bytes per read, waiting `delayMs` first; reads of attempt 1 at `hangAfter` bytes never settle.
    function trickleBlob(step: number, delayMs: number, hangAt: number | null) {
      const blob = new Blob([bytes as BlobPart]);
      const slice = blob.slice.bind(blob);
      const ranges: number[][] = [];
      let opened = 0;
      blob.slice = (start = 0, end = blob.size): Blob => {
        ranges.push([start, end]);
        const attempt = ++opened;
        const part = slice(start, end);
        let offset = start;
        part.stream = () => new ReadableStream({ type: 'bytes', async pull(controller) {
          if (hangAt !== null && attempt === 1 && offset >= hangAt && offset !== end) return new Promise<void>(() => {});
          await new Promise((r) => setTimeout(r, delayMs));
          let request: ReadableStreamBYOBRequest | null;
          try { request = controller.byobRequest; } catch { return; }
          if (!request) return;
          if (offset === end) { controller.close(); request.respond(0); return; }
          const view = new Uint8Array(request.view!.buffer, request.view!.byteOffset, request.view!.byteLength);
          const length = Math.min(view.length, end - offset, step);
          view.set(bytes.subarray(offset, offset + length));
          offset += length;
          request.respond(length);
        }, cancel() { return new Promise<void>(() => {}); } });
        part.arrayBuffer = async (): Promise<ArrayBuffer> => { throw new Error('unexpected allocated slice read'); };
        return part;
      };
      return { blob, ranges };
    }
    it('does not abandon a slow device that keeps delivering small pieces', async () => {
      const f = trickleBlob(1, 15, null); // 7 bytes at 15 ms each: far longer than stallMs in total, never silent for stallMs
      const result = await hashSource(f.blob, { chunkSize: 7, stallMs: 60 });
      expect(result!.hex).toBe(expected);
      expect(f.ranges).toEqual([[0, 7]]);
    });
    it('resumes after the bytes already delivered when a read stalls mid-chunk', async () => {
      const f = trickleBlob(2, 1, 4); // first open delivers bytes 0-3 then goes silent
      const result = await hashSource(f.blob, { chunkSize: 7, stallMs: 30 });
      expect(result!.hex).toBe(expected);
      expect(f.ranges).toEqual([[0, 7], [4, 7]]);
    });
    it('ignores bytes an abandoned read delivers after its timeout', async () => {
      const blob = lateBlob(3, 80, false);
      const progress: number[] = [];
      const result = await hashSource(blob, { chunkSize: 3, stallMs: 20, onProgress: (n) => progress.push(n) });
      expect(result!.hex).toBe(expected);
      expect(progress).toEqual([3, 6, 7]);
      await new Promise((r) => setTimeout(r, 120)); // let the abandoned read settle; nothing may throw or double count
    });
    it('returns null when cancelled right after a stall, even if cancelling the reopened stream never settles', async () => {
      const opens = new Map<number, number>();
      const blob = lateBlob(3, 10_000, true, opens);
      const outcome = await Promise.race([
        hashSource(blob, { chunkSize: 3, stallMs: 20, isCancelled: () => (opens.get(3) ?? 0) >= 2 }),
        new Promise<string>((r) => setTimeout(() => r('HUNG'), 1500)),
      ]);
      expect(outcome).toBeNull();
    });
  });
  it('does not return a fallback digest when cancelled by the final progress callback', async () => {
    const ac = new AbortController();
    await expect(hashBlob(new Blob(['abc']), {
      noWorker: true, signal: ac.signal, onProgress: () => ac.abort(),
    })).rejects.toMatchObject({ code: 'ABORTED' });
  });
  it.each(['data', 'eof'] as const)('returns null when cancelled during the final %s read', async (phase) => {
    const blob = new Blob(['abc']);
    const slice = blob.slice.bind(blob);
    let cancelled = false;
    blob.slice = (start = 0, end = blob.size): Blob => {
      const part = slice(start, end);
      let offset = start;
      part.stream = () => new ReadableStream({ type: 'bytes', async pull(controller) {
        const request = controller.byobRequest!;
        const eof = offset === end;
        if ((phase === 'eof') === eof) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          cancelled = true;
        }
        if (eof) { controller.close(); request.respond(0); return; }
        new Uint8Array(request.view!.buffer, request.view!.byteOffset, 3).set([97, 98, 99]);
        offset = end;
        request.respond(3);
      } });
      return part;
    };
    await expect(hashSource(blob, { isCancelled: () => cancelled })).resolves.toBeNull();
  });
  it('does not return a fallback digest when cancelled during the WebCrypto cross-check', async () => {
    const ac = new AbortController();
    const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    const mocked = vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, input) => {
      ac.abort();
      return digest(algorithm, input);
    });
    try {
      await expect(hashBlob(new Blob(['abc']), { noWorker: true, signal: ac.signal })).rejects.toMatchObject({ code: 'ABORTED' });
    } finally { mocked.mockRestore(); }
  });
  describe('cancellation while file I/O is pending', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
      return { promise, resolve, reject };
    }
    function observe(pending: Promise<unknown>): { value: unknown } {
      const outcome: { value: unknown } = { value: 'PENDING' };
      void pending.then((value) => { outcome.value = value; }, (error: unknown) => { outcome.value = error; });
      return outcome;
    }
    function pendingArrayBuffer(phase: 'fallback' | 'cross-check') {
      const blob = new Blob(['abc']);
      const slice = blob.slice.bind(blob);
      const input = deferred<ArrayBuffer>();
      let reads = 0;
      blob.slice = (start = 0, end = blob.size): Blob => {
        const part = slice(start, end);
        if (phase === 'fallback') part.stream = (): never => { throw new Error('BYOB unavailable'); };
        part.arrayBuffer = () => { reads++; return input.promise; };
        return part;
      };
      return { blob, input, reads: () => reads };
    }
    afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

    it.each(['data', 'eof'] as const)('cancels a never-settling BYOB %s read within the existing cleanup bound', async (phase) => {
      vi.useFakeTimers();
      const ac = new AbortController();
      const blob = new Blob(['abc']);
      const slice = blob.slice.bind(blob);
      const progress: number[] = [];
      let pending = false;
      let cancellations = 0;
      blob.slice = (start = 0, end = blob.size): Blob => {
        const part = slice(start, end);
        let delivered = false;
        part.stream = () => new ReadableStream({ type: 'bytes', pull(controller) {
          if (phase === 'data' || delivered) {
            pending = true;
            return new Promise<void>(() => {});
          }
          const request = controller.byobRequest!;
          new Uint8Array(request.view!.buffer, request.view!.byteOffset, 3).set([97, 98, 99]);
          delivered = true;
          request.respond(3);
        }, cancel() {
          cancellations++;
          return new Promise<void>(() => {});
        } });
        return part;
      };
      const outcome = observe(hashBlob(blob, { noWorker: true, signal: ac.signal, onProgress: (n) => progress.push(n) }));
      await vi.advanceTimersByTimeAsync(0);
      expect(pending).toBe(true);
      const beforeAbort = [...progress];
      ac.abort();
      await vi.advanceTimersByTimeAsync(CANCEL_SETTLE_MS + 1);
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      expect(cancellations).toBe(1);
      expect(progress).toEqual(beforeAbort);
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
      ['fallback', 'resolve'], ['fallback', 'reject'], ['cross-check', 'resolve'], ['cross-check', 'reject'],
    ] as const)('cancels a pending %s arrayBuffer read and ignores its late %s', async (phase, late) => {
      vi.useFakeTimers();
      const ac = new AbortController();
      const f = pendingArrayBuffer(phase);
      const progress: number[] = [];
      const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
      const outcome = observe(hashBlob(f.blob, { noWorker: true, signal: ac.signal, onProgress: (n) => progress.push(n) }));
      await vi.advanceTimersByTimeAsync(0);
      expect(f.reads()).toBe(1);
      const beforeAbort = [...progress];
      ac.abort();
      await vi.advanceTimersByTimeAsync(CANCEL_SETTLE_MS + 1);
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      if (late === 'resolve') f.input.resolve(Uint8Array.of(97, 98, 99).buffer);
      else f.input.reject(new Error('late backend failure'));
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      expect(progress).toEqual(beforeAbort);
      expect(digest).not.toHaveBeenCalled();
      expect(f.reads()).toBe(1);
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('cancels a never-settling WebCrypto digest and ignores its later completion', async () => {
      vi.useFakeTimers();
      const ac = new AbortController();
      const digest = deferred<ArrayBuffer>();
      const mock = vi.spyOn(globalThis.crypto.subtle, 'digest').mockReturnValue(digest.promise);
      const outcome = observe(hashBlob(new Blob(['abc']), { noWorker: true, signal: ac.signal }));
      await vi.advanceTimersByTimeAsync(0);
      expect(mock).toHaveBeenCalledOnce();
      ac.abort();
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      digest.resolve(Uint8Array.from(createHash('sha256').update('abc').digest()).buffer);
      await vi.advanceTimersByTimeAsync(0);
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('reports a short worker cross-check read as a typed failure instead of a skipped cross-check', async () => {
      vi.useFakeTimers();
      const f = pendingArrayBuffer('cross-check');
      const replies: unknown[] = [];
      const workerScope = {
        onmessage: null as ((event: MessageEvent) => void) | null,
        postMessage: (message: unknown): void => { replies.push(message); },
      };
      vi.stubGlobal('self', workerScope);
      try {
        await import('../../src/core/hash/hasher.worker');
        workerScope.onmessage!(new MessageEvent('message', { data: { type: 'start', blob: f.blob } }));
        await vi.waitFor(() => expect({ reads: f.reads(), replies }).toMatchObject({ reads: 1 }));
        f.input.resolve(new ArrayBuffer(2)); // The requested region contains three bytes.
        await vi.advanceTimersByTimeAsync(0);
        expect(replies.at(-1)).toMatchObject({ type: 'failed', code: 'INPUT_INVALID' });
        expect(f.reads()).toBe(1);
        expect(vi.getTimerCount()).toBe(0);
      } finally { vi.unstubAllGlobals(); }
    });

    it('releases abort listeners after successful hashing and still rejects a cross-check mismatch', async () => {
      const ac = new AbortController();
      expect((await hashBlob(new Blob(['abc']), { noWorker: true, signal: ac.signal })).hex)
        .toBe(createHash('sha256').update('abc').digest('hex'));
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      vi.spyOn(globalThis.crypto.subtle, 'digest').mockResolvedValue(new ArrayBuffer(32));
      await expect(hashBlob(new Blob(['abc']), { noWorker: true, signal: ac.signal }))
        .rejects.toMatchObject({ code: 'INTERNAL_HASH_MISMATCH' });
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    });
  });
  it('keeps progress and yield cadence across partial reads and a reopened slice', async () => {
    const bytes = Uint8Array.from({ length: 11 }, (_, index) => index);
    const blob = new Blob([bytes]);
    const slice = blob.slice.bind(blob);
    const ranges: number[][] = [];
    const progress: number[] = [];
    let yields = 0;
    blob.slice = (start = 0, end = blob.size): Blob => {
      ranges.push([start, end]);
      const part = slice(start, end);
      let offset = start;
      part.stream = () => new ReadableStream({ type: 'bytes', pull(controller) {
        const request = controller.byobRequest!;
        if (start === 3 && offset === 4) return new Promise<void>(() => {});
        if (offset === end) { controller.close(); request.respond(0); return; }
        new Uint8Array(request.view!.buffer, request.view!.byteOffset, 1)[0] = bytes[offset++]!;
        request.respond(1);
      } });
      return part;
    };
    const result = await hashSource(blob, {
      chunkSize: 3, stallMs: 20, onProgress: (done) => progress.push(done), yieldFn: async () => { yields++; },
    });
    expect(result!.hex).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(ranges).toEqual([[0, 3], [3, 6], [4, 6], [6, 9], [9, 11]]);
    expect(progress).toEqual([3, 6, 9, 11]);
    expect(yields).toBe(4);
  });
  describe('bounded abandoned hashing buffers', () => {
    function intermittentBlob(cancelMode: 'pending' | 'settled' | 'rejected', phase: 'data' | 'eof' = 'data') {
      const bytes = Uint8Array.from({ length: 15 }, (_, index) => index);
      const blob = new Blob([bytes]);
      const slice = blob.slice.bind(blob);
      const ranges: number[][] = [];
      let cancellations = 0;
      blob.slice = (start = 0, end = blob.size): Blob => {
        ranges.push([start, end]);
        const part = slice(start, end);
        let offset = start;
        part.stream = () => new ReadableStream({ type: 'bytes', pull(controller) {
          const request = controller.byobRequest!;
          // Each original slice delivers a byte, then needs a reopen; reopened slices finish normally.
          if (phase === 'data' && start % 3 === 0 && offset === start + 1 && offset < end) return new Promise<void>(() => {});
          if (phase === 'eof' && offset === end) return new Promise<void>(() => {});
          if (offset === end) { controller.close(); request.respond(0); return; }
          const length = start % 3 === 0 ? 1 : end - offset;
          new Uint8Array(request.view!.buffer, request.view!.byteOffset, length).set(bytes.subarray(offset, offset + length));
          offset += length;
          request.respond(length);
        }, cancel() {
          cancellations++;
          if (cancelMode === 'pending') return new Promise<void>(() => {});
          if (cancelMode === 'rejected') return Promise.reject(new Error('cancel backend failed'));
        } });
        return part;
      };
      return { blob, bytes, ranges, cancels: () => cancellations };
    }
    it.each(['pending', 'rejected'] as const)('bounds abandoned data buffers when cancellations are %s despite continued progress', async (mode) => {
      const f = intermittentBlob(mode);
      const progress: number[] = [];
      await expect(hashSource(f.blob, { chunkSize: 3, stallMs: 20, onProgress: (n) => progress.push(n) }))
        .rejects.toMatchObject({ code: 'INPUT_UNREADABLE' });
      expect(f.cancels()).toBe(3);
      expect(f.ranges).toEqual([[0, 3], [1, 3], [3, 6], [4, 6], [6, 9]]);
      expect(progress).toEqual([3, 6]);
    });
    it('releases the abandoned-buffer budget when cancellation completes', async () => {
      const f = intermittentBlob('settled');
      const progress: number[] = [];
      const result = await hashSource(f.blob, { chunkSize: 3, stallMs: 20, onProgress: (n) => progress.push(n) });
      expect(result!.hex).toBe(createHash('sha256').update(f.bytes).digest('hex'));
      expect(f.cancels()).toBe(5); // More than MAX_STALLS is safe when each previous backend releases its buffer.
      expect(f.ranges.length).toBe(10);
      expect(progress).toEqual([3, 6, 9, 12, 15]);
    });
    it('does not charge one-byte EOF probes against the full hashing-buffer budget', async () => {
      const f = intermittentBlob('pending', 'eof');
      const result = await hashSource(f.blob, { chunkSize: 3, stallMs: 20 });
      expect(result!.hex).toBe(createHash('sha256').update(f.bytes).digest('hex'));
      expect(f.cancels()).toBe(5);
      expect(f.ranges).toEqual([[0, 3], [3, 6], [6, 9], [9, 12], [12, 15]]);
    });
  });
  describe('worker outcomes', () => {
    // A stand-in worker that answers 'start' with one scripted message, as the real worker would.
    function fakeWorker(reply: Record<string, unknown>): { terminated: () => number } {
      let terminated = 0;
      class FakeWorker {
        onmessage: ((ev: { data: unknown }) => void) | null = null;
        onerror: (() => void) | null = null;
        postMessage(): void { setTimeout(() => this.onmessage?.({ data: reply }), 0); }
        terminate(): void { terminated++; }
      }
      vi.stubGlobal('Worker', FakeWorker);
      vi.stubGlobal('__WORKER_URL__', 'worker.js');
      return { terminated: () => terminated };
    }
    function countingBlob(): { blob: Blob; slices: () => number } {
      const blob = new Blob(['abc']);
      let slices = 0;
      const slice = blob.slice.bind(blob);
      blob.slice = (...args: Parameters<Blob['slice']>): Blob => { slices++; return slice(...args); };
      return { blob, slices: () => slices };
    }
    afterEach(() => { vi.unstubAllGlobals(); });

    it('falls back after a worker message cannot be deserialized and removes its handlers', async () => {
      const workers: DeserializationWorker[] = [];
      class DeserializationWorker {
        onmessage: ((ev: { data: unknown }) => void) | null = null;
        onmessageerror: (() => void) | null = null;
        onerror: (() => void) | null = null;
        terminated = 0;
        constructor() { workers.push(this); }
        postMessage(): void {}
        terminate(): void { this.terminated++; }
      }
      vi.stubGlobal('Worker', DeserializationWorker);
      vi.stubGlobal('__WORKER_URL__', 'worker.js');
      const ac = new AbortController();
      const result = hashBlob(new Blob(['abc']), { signal: ac.signal });
      const worker = workers[0]!;
      try {
        expect(worker.onmessageerror).toBeTypeOf('function');
        worker.onmessageerror!();
        expect((await result).hex).toBe(createHash('sha256').update('abc').digest('hex'));
        expect(worker.terminated).toBe(1);
        expect(worker.onmessageerror).toBeNull();
        expect(worker.onmessage).toBeNull();
        expect(worker.onerror).toBeNull();
        expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      } finally {
        ac.abort();
        await result.catch(() => {});
      }
    });

    it('clears the inline worker URL timer when hashing finishes', async () => {
      vi.useFakeTimers();
      fakeWorker({ type: 'done', digest: new Uint8Array(createHash('sha256').update('abc').digest()), bytes: 3, cross: 'ok' });
      vi.stubGlobal('__WORKER_INLINE__', 'void 0');
      const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:finished-worker');
      const revoke = vi.spyOn(URL, 'revokeObjectURL');
      try {
        const result = hashBlob(new Blob(['abc']));
        await vi.advanceTimersByTimeAsync(0);
        await result;
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:finished-worker');
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        create.mockRestore();
        revoke.mockRestore();
        vi.useRealTimers();
      }
    });

    it('ignores worker messages already queued when cancellation terminates the worker', async () => {
      let deliver!: (data: Record<string, unknown>) => void;
      class FakeWorker {
        onmessage: ((ev: { data: unknown }) => void) | null = null;
        onerror: (() => void) | null = null;
        postMessage(): void {
          const queuedHandler = this.onmessage;
          deliver = (data) => queuedHandler?.({ data });
        }
        terminate(): void {}
      }
      vi.stubGlobal('Worker', FakeWorker);
      vi.stubGlobal('__WORKER_URL__', 'worker.js');
      const ac = new AbortController();
      const progress: number[] = [];
      const result = hashBlob(new Blob(['abc']), { signal: ac.signal, onProgress: (n) => progress.push(n) });
      const cancelled = expect(result).rejects.toMatchObject({ code: 'ABORTED' });
      ac.abort();
      await cancelled;
      deliver({ type: 'progress', done: 3 });
      deliver({ type: 'done', digest: new Uint8Array(32), bytes: 3, cross: 'ok' });
      expect(progress).toEqual([]);
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    });

    it.each([null, undefined, 0, 'done', [], { type: 'progress', done: NaN },
      { type: 'progress', done: Infinity }, { type: 'progress', done: -1 },
      { type: 'progress', done: 4 }, { type: 'progress', done: '3' },
      { type: 'progress' }, { type: 'progress', done: 0.5 },
    ])('falls back on a malformed worker message: %j', async (message) => {
      let deliver!: (data: unknown) => void;
      let terminated = 0;
      class FakeWorker {
        onmessage: ((ev: { data: unknown }) => void) | null = null;
        onerror: (() => void) | null = null;
        postMessage(): void { deliver = (data) => this.onmessage?.({ data }); }
        terminate(): void { terminated++; }
      }
      vi.stubGlobal('Worker', FakeWorker);
      vi.stubGlobal('__WORKER_URL__', 'worker.js');
      const ac = new AbortController();
      const progress: number[] = [];
      const result = hashBlob(new Blob(['abc']), { signal: ac.signal, onProgress: (n) => progress.push(n) });
      try {
        expect(() => deliver(message)).not.toThrow();
        expect(progress).toEqual([]);
        expect(terminated).toBe(1);
        expect((await result).hex).toBe(createHash('sha256').update('abc').digest('hex'));
        expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      } finally {
        ac.abort();
        await result.catch(() => {});
      }
    });

    it.each([
      { digest: new Uint8Array([1]), bytes: 3, cross: 'ok' },
      { digest: new Uint8Array(32), bytes: 999, cross: 'ok' },
      { digest: new Uint8Array(32), bytes: 3, cross: 'unexpected' },
      { digest: new Array(32).fill(0), bytes: 3, cross: 'ok' },
      { digest: new Uint8Array(32), bytes: 3 },
    ])('falls back when a worker completion is malformed: %j', async (completion) => {
      const worker = fakeWorker({ type: 'done', ...completion });
      const { blob, slices } = countingBlob();
      const ac = new AbortController();
      const result = await hashBlob(blob, { signal: ac.signal });
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
      expect(result.hex).toBe(createHash('sha256').update('abc').digest('hex'));
      expect(result.bytes).toBe(blob.size);
      expect(slices()).toBeGreaterThan(0);
      expect(worker.terminated()).toBe(1);
    });

    it.each(['ok', 'skipped'])('accepts a complete worker digest with cross-check %s', async (cross) => {
      const digest = new Uint8Array(createHash('sha256').update('abc').digest());
      const worker = fakeWorker({ type: 'done', digest, bytes: 3, cross });
      expect((await hashBlob(new Blob(['abc']))).hex).toBe(createHash('sha256').update('abc').digest('hex'));
      expect(worker.terminated()).toBe(1);
    });

    it('preserves a valid worker cross-check mismatch as a hard failure', async () => {
      fakeWorker({ type: 'done', digest: new Uint8Array(32), bytes: 3, cross: 'mismatch' });
      const { blob, slices } = countingBlob();
      await expect(hashBlob(blob)).rejects.toMatchObject({ code: 'INTERNAL_HASH_MISMATCH' });
      expect(slices()).toBe(0);
    });

    it('releases an inline script URL when worker construction fails', async () => {
      class ThrowingWorker { constructor() { throw new Error('worker blocked'); } }
      vi.stubGlobal('Worker', ThrowingWorker);
      vi.stubGlobal('__WORKER_INLINE__', 'void 0');
      const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:blocked-worker');
      const revoke = vi.spyOn(URL, 'revokeObjectURL');
      try {
        expect((await hashBlob(new Blob(['abc']))).hex)
          .toBe(createHash('sha256').update('abc').digest('hex'));
        expect(create).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:blocked-worker');
      } finally {
        create.mockRestore();
        revoke.mockRestore();
      }
    });

    it('removes the failed worker abort listener before falling back', async () => {
      fakeWorker({ type: 'error' });
      const ac = new AbortController();
      expect((await hashBlob(new Blob(['abc']), { signal: ac.signal })).hex)
        .toBe(createHash('sha256').update('abc').digest('hex'));
      expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    });

    it.each(['INPUT_UNREADABLE', 'INPUT_INVALID'])('reports a worker %s without re-hashing the file on the main thread', async (code) => {
      const worker = fakeWorker({ type: 'failed', code, message: 'typed failure' });
      const { blob, slices } = countingBlob();
      await expect(hashBlob(blob)).rejects.toMatchObject({ code, message: 'typed failure' });
      expect(slices()).toBe(0);
      expect(worker.terminated()).toBe(1);
    });
    it('still falls back to the main thread when the worker itself cannot hash', async () => {
      fakeWorker({ type: 'error' });
      const { blob, slices } = countingBlob();
      expect((await hashBlob(blob)).hex).toBe(createHash('sha256').update('abc').digest('hex'));
      expect(slices()).toBeGreaterThan(0);
    });
    it('does not trust an unexpected failure code from the worker', async () => {
      fakeWorker({ type: 'failed', code: 'NET_FAILED', message: 'x' });
      const { blob } = countingBlob();
      expect((await hashBlob(blob)).hex).toBe(createHash('sha256').update('abc').digest('hex'));
    });
  });
  it('rejects invalid chunk sizes instead of hanging or allocating invalid buffers', async () => {
    for (const chunkSize of [0, -1, 0.5, NaN, Infinity]) {
      await expect(hashSource(new Blob(['x']), { chunkSize })).rejects.toMatchObject({ code: 'INPUT_INVALID' });
    }
  });
  it('rejects an invalid declared source size before reading', async () => {
    for (const size of [-1, 0.5, NaN, Infinity]) {
      const source = { size, slice: (): never => { throw new Error('invalid source was read'); } };
      await expect(hashSource(source)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
    }
  });
  it('refuses slice reads whose lengths disagree with the requested file region', async () => {
    for (const length of [0, 2, 4]) {
      let reads = 0;
      const source = { size: 3, slice: () => {
        // A guard makes the broken implementation fail promptly instead of starving the test runner forever.
        if (++reads > 1) throw new Error('hashing continued after a premature end of input');
        return { arrayBuffer: async () => new ArrayBuffer(length) };
      } };
      await expect(hashSource(source)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
    }
  });
  it('rejects a byte stream that ends before its declared file size', async () => {
    const blob = new Blob(['abc']);
    const source = { size: 4, stream: () => blob.stream(), slice: (): never => { throw new Error('unexpected slice'); } };
    await expect(hashSource(source)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
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
