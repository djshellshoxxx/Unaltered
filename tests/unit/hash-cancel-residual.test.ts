import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANCEL_SETTLE_MS, hashSource } from '../../src/core/hash/stream';

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
