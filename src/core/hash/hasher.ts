// Main-thread API for hashing (SPEC 5.2). Uses a Web Worker where possible and falls back to the same
// chunked code on the main thread (yielding between chunks) where workers are unavailable, e.g. file:// in Chrome.
import { toHex, equalBytes } from '../bytes';
import { UnalteredError, type ErrorCode } from '../errors';
import { CHUNK_SIZE, CROSS_CHECK_MAX, hashSource, readCrossCheckInput } from './stream';

export interface HashResult {
  digest: Uint8Array;
  hex: string;
  bytes: number;
}

export interface HashOptions {
  signal?: AbortSignal | undefined;
  onProgress?: ((bytesDone: number) => void) | undefined;
  /** Test seam: force the main-thread path. */
  noWorker?: boolean;
}

/** Injected by the build: URL of the worker script (multi-file) or inline source (single-file). */
declare const __WORKER_URL__: string | null;
declare const __WORKER_INLINE__: string | null;

export { CROSS_CHECK_MAX } from './stream';

const MISMATCH = 'Internal error: two fingerprint calculations disagree. Do not use this result.';

/** Input failures a working worker reports; retrying them on the main thread would re-read the whole file. */
const WORKER_FAILURES: readonly ErrorCode[] = ['INPUT_INVALID', 'INPUT_UNREADABLE'];

const nextTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

interface TrustedTypesApi {
  createPolicy(name: string, rules: { createScriptURL(s: string): string }): { createScriptURL(s: string): string };
}

// Trusted Types allows each policy name once, so create it lazily and keep it. It only ever approves the one
// worker URL the app itself is about to use (SR-1 require-trusted-types-for 'script').
let policy: { createScriptURL(s: string): string } | null = null;
let approvedUrl = '';
function workerPolicy(tt: TrustedTypesApi): { createScriptURL(s: string): string } {
  policy ??= tt.createPolicy('unaltered-worker', {
    createScriptURL: (s: string) => {
      if (s !== approvedUrl) throw new TypeError('unexpected worker url');
      return s;
    },
  });
  return policy;
}

function makeWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    const inline = typeof __WORKER_INLINE__ === 'string' ? __WORKER_INLINE__ : null;
    const url = typeof __WORKER_URL__ === 'string' ? __WORKER_URL__ : null;
    if (inline === null && url === null) return null;
    const tt = (globalThis as { trustedTypes?: TrustedTypesApi }).trustedTypes;
    let src: string;
    let blobUrl: string | null = null;
    if (inline !== null) {
      blobUrl = URL.createObjectURL(new Blob([inline], { type: 'text/javascript' }));
      src = blobUrl;
    } else {
      src = url as string;
    }
    if (tt) {
      approvedUrl = src;
      src = workerPolicy(tt).createScriptURL(src);
    }
    const w = new Worker(src);
    if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl as string), 10_000);
    return w;
  } catch {
    return null;
  }
}

function hashInWorker(w: Worker, blob: Blob, opts: HashOptions): Promise<{ digest: Uint8Array; bytes: number; cross: string } | 'unavailable'> {
  return new Promise((resolve, reject) => {
    const abort = (): void => {
      w.terminate();
      reject(new UnalteredError('ABORTED', 'Cancelled.'));
    };
    if (opts.signal?.aborted) return abort();
    opts.signal?.addEventListener('abort', abort, { once: true });
    w.onmessage = (ev: MessageEvent<{ type: string; done?: number; digest?: Uint8Array; bytes?: number; cross?: string; code?: string; message?: string }>) => {
      const m = ev.data;
      if (m.type === 'progress') opts.onProgress?.(m.done ?? 0);
      else if (m.type === 'done') {
        opts.signal?.removeEventListener('abort', abort);
        w.terminate();
        resolve({ digest: m.digest as Uint8Array, bytes: m.bytes as number, cross: m.cross ?? 'skipped' });
      } else if (m.type === 'failed' && WORKER_FAILURES.includes(m.code as ErrorCode) && typeof m.message === 'string') {
        opts.signal?.removeEventListener('abort', abort);
        w.terminate();
        reject(new UnalteredError(m.code as ErrorCode, m.message));
      } else {
        w.terminate();
        resolve('unavailable');
      }
    };
    w.onerror = () => {
      w.terminate();
      resolve('unavailable');
    };
    try {
      w.postMessage({ type: 'start', blob, chunkSize: CHUNK_SIZE });
    } catch {
      w.terminate();
      resolve('unavailable');
    }
  });
}

async function crossCheck(blob: Blob, digest: Uint8Array): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || blob.size > CROSS_CHECK_MAX) return;
  const other = new Uint8Array(await subtle.digest('SHA-256', await readCrossCheckInput(blob)));
  if (!equalBytes(other, digest)) {
    throw new UnalteredError('INTERNAL_HASH_MISMATCH', MISMATCH);
  }
}

export async function hashBlob(blob: Blob, opts: HashOptions = {}): Promise<HashResult> {
  if (opts.signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  let result: { digest: Uint8Array; bytes: number } | null = null;
  let crossDone = false;
  if (!opts.noWorker) {
    const w = makeWorker();
    if (w) {
      const r = await hashInWorker(w, blob, opts);
      if (r !== 'unavailable') {
        result = r;
        if (r.cross === 'mismatch') throw new UnalteredError('INTERNAL_HASH_MISMATCH', MISMATCH);
        crossDone = r.cross === 'ok';
      }
    }
  }
  if (!result) {
    const r = await hashSource(blob, {
      isCancelled: () => opts.signal?.aborted === true,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      yieldFn: nextTick,
    });
    if (!r) throw new UnalteredError('ABORTED', 'Cancelled.');
    result = r;
  }
  if (!crossDone) await crossCheck(blob, result.digest);
  return { digest: result.digest, hex: toHex(result.digest), bytes: result.bytes };
}
