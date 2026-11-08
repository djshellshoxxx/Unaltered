import { createHash } from 'node:crypto';
import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashBlob } from '../../src/core/hash/hasher';

class SilentWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = 0;
  postMessage(): void {}
  terminate(): void { this.terminated++; }
}

function installWorker(): SilentWorker {
  const worker = new SilentWorker();
  vi.stubGlobal('Worker', class { constructor() { return worker; } });
  vi.stubGlobal('__WORKER_INLINE__', 'void 0');
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:startup-fixture');
  return worker;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('worker initialization lifecycle', () => {
  it('falls back and releases resources when a worker never initializes', async () => {
    vi.useFakeTimers();
    const worker = installWorker();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const controller = new AbortController();
    const result = hashBlob(new Blob(), { signal: controller.signal });
    try {
      await vi.advanceTimersByTimeAsync(10_000);
      expect(worker.terminated).toBe(1);
      expect((await result).hex).toBe(createHash('sha256').digest('hex'));
      expect(worker.onmessage).toBeNull();
      expect(worker.onmessageerror).toBeNull();
      expect(worker.onerror).toBeNull();
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:startup-fixture');
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally { controller.abort(); await result.catch(() => {}); }
  });

  it('allows a ready worker to read slowly without a whole-file deadline', async () => {
    vi.useFakeTimers();
    const worker = installWorker();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const controller = new AbortController();
    const blob = new Blob(['abc']);
    const slice = vi.spyOn(blob, 'slice');
    const result = hashBlob(blob, { signal: controller.signal });
    try {
      worker.onmessage!({ data: { type: 'ready' } });
      await vi.advanceTimersByTimeAsync(120_000);
      expect(worker.terminated).toBe(0);
      expect(slice).not.toHaveBeenCalled();
      expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:startup-fixture');
      const digest = new Uint8Array(createHash('sha256').update('abc').digest());
      worker.onmessage!({ data: { type: 'done', digest, bytes: blob.size, cross: 'ok' } });
      expect((await result).hex).toBe(createHash('sha256').update('abc').digest('hex'));
      expect(worker.terminated).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { controller.abort(); await result.catch(() => {}); }
  });

  it('clears the startup watchdog when cancelled before the worker answers', async () => {
    vi.useFakeTimers();
    const worker = installWorker();
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const controller = new AbortController();
    const result = hashBlob(new Blob(['abc']), { signal: controller.signal });
    const cancelled = expect(result).rejects.toMatchObject({ code: 'ABORTED' });
    controller.abort();
    await cancelled;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(worker.terminated).toBe(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:startup-fixture');
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('announces readiness before receiving a file', async () => {
    const messages: unknown[] = [];
    const workerScope = { onmessage: null, postMessage: (message: unknown): void => { messages.push(message); } };
    vi.stubGlobal('self', workerScope);
    await import('../../src/core/hash/hasher.worker');
    expect(workerScope.onmessage).toBeTypeOf('function');
    expect(messages).toEqual([{ type: 'ready' }]);
  });
});
