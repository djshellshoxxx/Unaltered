import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';
import { CANCEL_SETTLE_MS, CHUNK_SIZE, STALL_MS, hashSource } from '../../src/core/hash/stream';

// Abort guards not covered by hash.test.ts: the non-Blob BYOB min-read and the yield between chunks.
describe('cancellation of the remaining awaits in hashSource', () => {
  afterEach(() => { vi.useRealTimers(); });

  function observe(pending: Promise<unknown>): { value: unknown } {
    const outcome: { value: unknown } = { value: 'PENDING' };
    void pending.then((value) => { outcome.value = value; }, (error: unknown) => { outcome.value = error; });
    return outcome;
  }

  it('stops waiting on a never-settling non-Blob BYOB read and reads no further', async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    let pulls = 0;
    let cancels = 0;
    const src = {
      size: 3,
      slice: (): never => { throw new Error('unexpected slice allocation'); },
      stream: () => new ReadableStream({ type: 'bytes', pull() { pulls++; return new Promise<void>(() => {}); },
        cancel() { cancels++; return new Promise<void>(() => {}); } }),
    };
    const progress: number[] = [];
    const outcome = observe(hashSource(src, { signal: ac.signal, onProgress: (n) => progress.push(n) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(pulls).toBe(1);
    expect(outcome.value).toBe('PENDING');
    ac.abort();
    await vi.advanceTimersByTimeAsync(CANCEL_SETTLE_MS + 1);
    expect(outcome.value).toBeNull();
    expect(pulls).toBe(1);
    expect(cancels).toBe(1);
    expect(progress).toEqual([]);
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops waiting on a never-settling yield between chunks and reads no further', async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    let reads = 0;
    const src = {
      size: 6,
      slice: (start: number, end: number) => ({ arrayBuffer: (): Promise<ArrayBuffer> => { reads++; return Promise.resolve(new ArrayBuffer(end - start)); } }),
    };
    let yields = 0;
    const outcome = observe(hashSource(src, { chunkSize: 3, signal: ac.signal, yieldFn: () => { yields++; return new Promise<void>(() => {}); } }));
    await vi.advanceTimersByTimeAsync(0);
    expect(yields).toBe(1);
    expect(reads).toBe(1);
    ac.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome.value).toBeNull();
    expect(reads).toBe(1);
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
  });
});

// Residual recorded on 2026-10-30 (docs/CONSOLIDATION_20261030.md): abort during a pending main-thread BYOB read waited
// for the STALL_MS watchdog, and a pending cross-check slice read never settled. Closed by abort-driven waits in
// 8d3e7cb; these lock it in for reads after the first slice (docs/evidence/hash-cancel-20261111.md).
describe('prompt settlement of main-thread fallback cancellation mid-file', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  function observe(pending: Promise<unknown>): { value: unknown } {
    const outcome: { value: unknown } = { value: 'PENDING' };
    void pending.then((value) => { outcome.value = value; }, (error: unknown) => { outcome.value = error; });
    return outcome;
  }

  /** Two slices; the second one's data read, end-of-slice check or cross-check read never settles. */
  function stuckSecondSlice(stuck: 'data' | 'eof' | 'cross-check', cancelSettles: boolean) {
    const size = CHUNK_SIZE + 5;
    const blob = new Blob([new Uint8Array(size)]);
    const slice = blob.slice.bind(blob);
    const ranges: number[][] = [];
    let pending = 0;
    let cancels = 0;
    blob.slice = (start = 0, end = blob.size): Blob => {
      ranges.push([start, end]);
      const part = slice(start, end);
      const second = start >= CHUNK_SIZE;
      let offset = 0;
      const length = end - start;
      part.stream = () => new ReadableStream({
        type: 'bytes',
        pull(controller) {
          if (second && (stuck === 'data' || (stuck === 'eof' && offset === length))) {
            pending++;
            return new Promise<void>(() => {});
          }
          if (offset === length) { controller.close(); controller.byobRequest?.respond(0); return; }
          const request = controller.byobRequest!;
          const n = Math.min(request.view!.byteLength, length - offset);
          offset += n;
          request.respond(n);
        },
        cancel() { cancels++; return cancelSettles ? Promise.resolve() : new Promise<void>(() => {}); },
      });
      if (stuck === 'cross-check' && second) part.arrayBuffer = () => { pending++; return new Promise<ArrayBuffer>(() => {}); };
      return part;
    };
    return { blob, ranges, pending: () => pending, cancels: () => cancels };
  }

  async function abortWhileStuck(f: ReturnType<typeof stuckSecondSlice>, ac: AbortController): Promise<{ value: unknown }> {
    const outcome = observe(hashBlob(f.blob, { noWorker: true, signal: ac.signal }));
    await vi.waitFor(() => expect(f.pending()).toBe(1));
    expect(outcome.value).toBe('PENDING');
    ac.abort();
    return outcome;
  }

  it.each(['data', 'eof'] as const)('settles at once when a second-slice BYOB %s read is pending and cancellation completes', async (stuck) => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const f = stuckSecondSlice(stuck, true);
    const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
    const outcome = await abortWhileStuck(f, ac);
    await vi.advanceTimersByTimeAsync(0); // No timer may be needed: not STALL_MS, not CANCEL_SETTLE_MS.
    expect(outcome.value).toMatchObject({ code: 'ABORTED' });
    expect(f.ranges).toEqual([[0, CHUNK_SIZE], [CHUNK_SIZE, CHUNK_SIZE + 5]]);
    expect(f.cancels()).toBe(1);
    expect(digest).not.toHaveBeenCalled();
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['data', 'eof'] as const)('settles within CANCEL_SETTLE_MS, never STALL_MS, when a second-slice %s read and its cancellation both hang', async (stuck) => {
    vi.useFakeTimers();
    expect(CANCEL_SETTLE_MS).toBeLessThan(STALL_MS);
    const ac = new AbortController();
    const f = stuckSecondSlice(stuck, false);
    const outcome = await abortWhileStuck(f, ac);
    await vi.advanceTimersByTimeAsync(CANCEL_SETTLE_MS);
    expect(outcome.value).toMatchObject({ code: 'ABORTED' });
    expect(f.ranges).toEqual([[0, CHUNK_SIZE], [CHUNK_SIZE, CHUNK_SIZE + 5]]);
    expect(f.cancels()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('settles at once when a later cross-check slice read never settles, and starts no further reads', async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    const f = stuckSecondSlice('cross-check', true);
    const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
    const outcome = await abortWhileStuck(f, ac);
    const slicesAtAbort = f.ranges.length;
    await vi.advanceTimersByTimeAsync(0);
    expect(outcome.value).toMatchObject({ code: 'ABORTED' });
    // Hashing used two slices; the cross-check read its first chunk and is stuck on the second.
    expect(f.ranges.slice(-2)).toEqual([[0, CHUNK_SIZE], [CHUNK_SIZE, CHUNK_SIZE + 5]]);
    expect(f.ranges).toHaveLength(slicesAtAbort);
    expect(digest).not.toHaveBeenCalled();
    expect(getEventListeners(ac.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
