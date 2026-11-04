// Main-thread API for hashing (SPEC 5.2). Uses a Web Worker where possible and falls back to the same
// chunked code on the main thread (yielding between chunks) where workers are unavailable, e.g. file:// in Chrome.
import { toHex, equalBytes } from '../bytes';
import { UnalteredError, type ErrorCode } from '../errors';
import { CHUNK_SIZE, CROSS_CHECK_MAX, awaitAbortable, hashSource, readCrossCheckInput } from './stream';

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

/**
 * Injected by the build. Both shipped pages use the inline source, started from a blob: URL so the worker inherits the
 * page's CSP and Trusted Types (a worker loaded from its own URL would not). The URL form is used by unit tests.
 */
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

/** The blob: URL each inline worker was started from; released once that worker has answered or been stopped. */
const scriptUrls = new WeakMap<Worker, string>();
function releaseScript(w: Worker): void {
  const url = scriptUrls.get(w);
  if (url === undefined) return;
  scriptUrls.delete(w);
  URL.revokeObjectURL(url);
}

function makeWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  let blobUrl: string | null = null;
  try {
    const inline = typeof __WORKER_INLINE__ === 'string' ? __WORKER_INLINE__ : null;
    const url = typeof __WORKER_URL__ === 'string' ? __WORKER_URL__ : null;
    if (inline === null && url === null) return null;
    const tt = (globalThis as { trustedTypes?: TrustedTypesApi }).trustedTypes;
    let src: string;
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
    if (blobUrl) {
      scriptUrls.set(w, blobUrl);
      setTimeout(() => releaseScript(w), 10_000);
    }
    return w;
  } catch {
    if (blobUrl !== null) URL.revokeObjectURL(blobUrl);
    return null;
  }
}

function hashInWorker(w: Worker, blob: Blob, opts: HashOptions): Promise<{ digest: Uint8Array; bytes: number; cross: string } | 'unavailable'> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (): void => {
      settled = true;
      opts.signal?.removeEventListener('abort', abort);
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
      releaseScript(w);
    };
    const abort = (): void => {
      if (settled) return;
      finish();
      reject(new UnalteredError('ABORTED', 'Cancelled.'));
    };
    const unavailable = (): void => {
      if (settled) return;
      finish();
      resolve('unavailable');
    };
    if (opts.signal?.aborted) return abort();
    opts.signal?.addEventListener('abort', abort, { once: true });
    w.onmessage = (ev: MessageEvent<{ type: string; done?: number; digest?: Uint8Array; bytes?: number; cross?: string; code?: string; message?: string }>) => {
      if (settled) return;
      if (opts.signal?.aborted) return abort();
      const m = ev.data;
      if (m.type === 'progress') opts.onProgress?.(m.done ?? 0);
      else if (m.type === 'done') {
        // A completion must describe the whole input and a SHA-256 digest before its cross-check is trusted.
        if (!(m.digest instanceof Uint8Array) || m.digest.length !== 32 || m.bytes !== blob.size
          || !['ok', 'mismatch', 'skipped'].includes(m.cross ?? '')) return unavailable();
        finish();
        resolve({ digest: m.digest, bytes: m.bytes, cross: m.cross as string });
      } else if (m.type === 'failed' && WORKER_FAILURES.includes(m.code as ErrorCode) && typeof m.message === 'string') {
        finish();
        reject(new UnalteredError(m.code as ErrorCode, m.message));
      } else unavailable();
    };
    w.onerror = unavailable;
    try {
      w.postMessage({ type: 'start', blob, chunkSize: CHUNK_SIZE });
    } catch {
      unavailable();
    }
  });
}

async function crossCheck(blob: Blob, digest: Uint8Array, signal?: AbortSignal): Promise<void> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || blob.size > CROSS_CHECK_MAX) return;
  const input = await readCrossCheckInput(blob, signal);
  const other = new Uint8Array(await awaitAbortable(subtle.digest('SHA-256', input), signal));
  if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
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
      signal: opts.signal,
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      yieldFn: nextTick,
    });
    if (!r) throw new UnalteredError('ABORTED', 'Cancelled.');
    result = r;
  }
  if (opts.signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  if (!crossDone) await crossCheck(blob, result.digest, opts.signal);
  if (opts.signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  return { digest: result.digest, hex: toHex(result.digest), bytes: result.bytes };
}
