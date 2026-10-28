// Dedicated worker: streams the Blob in chunks so memory does not scale with file size (FR-1).
import { equalBytes } from '../bytes';
import { UnalteredError } from '../errors';
import { CROSS_CHECK_MAX, hashSource, readCrossCheckInput } from './stream';

// The WebCrypto differential check (FR-1) runs here so the main thread never copies the file.
async function cross(blob: Blob, digest: Uint8Array): Promise<'ok' | 'mismatch' | 'skipped'> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || blob.size > CROSS_CHECK_MAX) return 'skipped';
  try {
    const other = new Uint8Array(await subtle.digest('SHA-256', await readCrossCheckInput(blob)));
    return equalBytes(other, digest) ? 'ok' : 'mismatch';
  } catch {
    return 'skipped';
  }
}

interface StartMsg {
  type: 'start';
  blob: Blob;
  chunkSize?: number;
}

// The DOM and WebWorker libs conflict, so describe the few worker globals we use.
const ctx = self as unknown as {
  onmessage: ((ev: MessageEvent<StartMsg | { type: 'cancel' }>) => void) | null;
  postMessage(m: unknown): void;
};

let cancelled = false;

ctx.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  const opts = {
    isCancelled: () => cancelled,
    onProgress: (done: number) => ctx.postMessage({ type: 'progress', done }),
    ...(msg.chunkSize ? { chunkSize: msg.chunkSize } : {}),
  };
  hashSource(msg.blob, opts)
    .then(async (r) => {
      if (!r) return ctx.postMessage({ type: 'cancelled' });
      ctx.postMessage({ type: 'done', digest: r.digest, bytes: r.bytes, cross: await cross(msg.blob, r.digest) });
    })
    // A typed input failure is the answer for this file; anything else means this worker cannot hash here.
    .catch((e: unknown) => ctx.postMessage(e instanceof UnalteredError
      ? { type: 'failed', code: e.code, message: e.message }
      : { type: 'error' }));
};
