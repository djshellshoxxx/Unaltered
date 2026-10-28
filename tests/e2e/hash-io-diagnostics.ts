/** Installed by Playwright inside the real worker; no product logging or additional worker messages. */
export function installHashIoDiagnostics(): void {
  const state = {
    operation: 'installed', since: performance.now(),
    slices: 0, reads: 0, cancels: 0, releases: 0, bytes: 0,
    start: 0, end: 0, requested: 0, returned: 0, readDone: false,
  };
  (globalThis as unknown as { __hashIoTrace: typeof state }).__hashIoTrace = state;
  const mark = (operation: string): void => { state.operation = operation; state.since = performance.now(); };
  const slice = Blob.prototype.slice;
  Blob.prototype.slice = function (this: Blob, start = 0, end = this.size, type?: string): Blob {
    state.slices++; state.start = start; state.end = end;
    mark('slice');
    return slice.call(this, start, end, type);
  };
  const prototype = ReadableStreamBYOBReader.prototype;
  const read = prototype.read;
  Object.defineProperty(prototype, 'read', { configurable: true, writable: true,
    value: function (this: ReadableStreamBYOBReader, view: Uint8Array<ArrayBuffer>, options?: { min?: number }) {
      state.reads++; state.requested = view.byteLength;
      mark('read-await');
      const result = read.call(this, view, options);
      // Observe the original promise without replacing it or delaying the application's await.
      void result.then((value) => {
        state.returned = value.value?.byteLength ?? 0; state.bytes += state.returned; state.readDone = value.done;
        mark('read-settled');
      }, () => mark('read-rejected'));
      return result;
    },
  });
  const cancel = prototype.cancel;
  Object.defineProperty(prototype, 'cancel', { configurable: true, writable: true,
    value: function (this: ReadableStreamBYOBReader, reason?: unknown) {
      state.cancels++; mark('cancel-await');
      const result = cancel.call(this, reason);
      void result.then(() => mark('cancel-settled'), () => mark('cancel-rejected'));
      return result;
    },
  });
  const release = prototype.releaseLock;
  prototype.releaseLock = function (): void {
    state.releases++; mark('release-start');
    release.call(this); mark('release-end');
  };
}
