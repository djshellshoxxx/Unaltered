import { getEventListeners } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectBlob, stripMetadata } from '../../src/core/strip';
import { makeJpeg } from '../helpers/images';

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function observe(promise: Promise<unknown>): { value: unknown } {
  const outcome: { value: unknown } = { value: 'PENDING' };
  void promise.then((value) => { outcome.value = value; }, (error: unknown) => { outcome.value = error; });
  return outcome;
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('native Blob preprocessing cancellation', () => {
  for (const [name, operation] of [['detect', detectBlob], ['strip', stripMetadata]] as const) {
    it(`${name}: rejects an already aborted request before any native read`, async () => {
      const controller = new AbortController();
      controller.abort();
      const blob = new Blob([makeJpeg() as BlobPart]);
      const slice = vi.spyOn(blob, 'slice');
      const read = vi.spyOn(blob, 'arrayBuffer');
      await expect(operation(blob, controller.signal)).rejects.toMatchObject({ code: 'ABORTED' });
      expect(slice).not.toHaveBeenCalled();
      expect(read).not.toHaveBeenCalled();
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    });

    for (const late of ['resolve', 'reject'] as const) {
      it(`${name}: abandons a stalled header read and safely consumes its late ${late}`, async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const blob = new Blob([makeJpeg() as BlobPart]);
        const head = blob.slice(0, 16);
        const bytes = await head.arrayBuffer();
        const pending = deferred<ArrayBuffer>();
        vi.spyOn(head, 'arrayBuffer').mockReturnValue(pending.promise);
        const slice = vi.spyOn(blob, 'slice').mockReturnValue(head);
        const read = vi.spyOn(blob, 'arrayBuffer');
        const outcome = observe(operation(blob, controller.signal));
        await vi.advanceTimersByTimeAsync(0);
        expect(outcome.value).toBe('PENDING');
        controller.abort();
        try {
          await vi.advanceTimersByTimeAsync(0);
          expect(outcome.value).toMatchObject({ code: 'ABORTED' });
          expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
          expect(vi.getTimerCount()).toBe(0);
        } finally {
          if (late === 'resolve') pending.resolve(bytes);
          else pending.reject(new Error('native read failed after cancellation'));
          await vi.advanceTimersByTimeAsync(0);
        }
        expect(outcome.value).toMatchObject({ code: 'ABORTED' });
        expect(slice).toHaveBeenCalledOnce();
        expect(read).not.toHaveBeenCalled();
      });
    }

    it(`${name}: releases abort listeners after a successful read`, async () => {
      const controller = new AbortController();
      const blob = new Blob([makeJpeg() as BlobPart]);
      expect(await operation(blob, controller.signal)).toEqual(await operation(blob));
      expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
    });
  }

  for (const late of ['resolve', 'reject'] as const) {
    it(`strip: abandons the full native read and safely consumes its late ${late}`, async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const blob = new Blob([makeJpeg() as BlobPart]);
      const bytes = await blob.arrayBuffer();
      const pending = deferred<ArrayBuffer>();
      const read = vi.spyOn(blob, 'arrayBuffer').mockReturnValue(pending.promise);
      const outcome = observe(stripMetadata(blob, controller.signal));
      await vi.advanceTimersByTimeAsync(0);
      expect(read).toHaveBeenCalledOnce();
      expect(outcome.value).toBe('PENDING');
      controller.abort();
      try {
        await vi.advanceTimersByTimeAsync(0);
        expect(outcome.value).toMatchObject({ code: 'ABORTED' });
        expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        if (late === 'resolve') pending.resolve(bytes);
        else pending.reject(new Error('native read failed after cancellation'));
        await vi.advanceTimersByTimeAsync(0);
      }
      expect(outcome.value).toMatchObject({ code: 'ABORTED' });
      expect(read).toHaveBeenCalledOnce();
    });
  }
});
