// Streaming SHA-256 over a Blob using @noble/hashes' incremental API (FR-1).
// Shared by the Web Worker and the main-thread fallback so both paths are identical.
import { sha256 } from '@noble/hashes/sha2.js';
import { toHex } from '../bytes';
import { UnalteredError } from '../errors';

export const CHUNK_SIZE = 4 * 1024 * 1024;
export const CROSS_CHECK_MAX = 64 * 1024 * 1024;
/**
 * A slice read that delivers no bytes for this long is abandoned and the unhashed rest of the slice is reopened.
 * Progress-based: reads take whatever the backend has (no BYOB `min`), so a slow but moving source never trips it.
 */
export const STALL_MS = 30_000;
/** Limit consecutive silent reads at one offset and abandoned data readers whose cancellation has not completed. */
export const MAX_STALLS = 3;
/** Longest the cleanup waits for a reader's cancellation to settle; a stuck backend may never settle it. */
export const CANCEL_SETTLE_MS = 1_000;

const STALLED = Symbol('stalled');

/** Stops waiting on abort; it does not claim to cancel native operations such as Blob.arrayBuffer or WebCrypto. */
export function awaitAbortable<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  let abort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(new UnalteredError('ABORTED', 'Cancelled.'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
  // Attach both outcomes even after abort so a late native rejection is always consumed.
  return Promise.race([cancelled, pending]).finally(() => signal.removeEventListener('abort', abort));
}

function within<T>(pending: Promise<T>, ms: number, signal?: AbortSignal): Promise<T | typeof STALLED> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stall = new Promise<typeof STALLED>((resolve) => { timer = setTimeout(() => resolve(STALLED), ms); });
  return awaitAbortable(Promise.race([pending, stall]), signal).finally(() => clearTimeout(timer));
}

/** Drops a reader whose read is stuck. Its cancellation is not awaited: a stuck backend may never settle it. */
function abandon(reader: ReadableStreamBYOBReader): Promise<void> {
  const cancelling = reader.cancel();
  try { reader.releaseLock(); } catch { /* Older engines refuse while a read is pending; the reader is dropped anyway. */ }
  return cancelling;
}

function unreadable(): UnalteredError {
  return new UnalteredError('INPUT_UNREADABLE', 'The browser stopped delivering the file. Try again, or copy the file to a local disk first.');
}

/**
 * A file read that rejects means the file can no longer be read (deleted, modified, permission or device lost).
 * Engines report this as TypeError (Chromium stream reads) or DOMException (NotFoundError/NotReadableError from
 * arrayBuffer); the raw message can name the file, so callers only ever see the typed, generic error.
 */
function readFailure(error: unknown): UnalteredError {
  if (error instanceof UnalteredError) return error;
  const typed = unreadable();
  readFailures.add(typed);
  return typed;
}

// Errors made by readFailure. A worker must not treat one as final: some engines (WebKit, single-file build from
// file://) cannot read the Blob inside a worker at all, while the main thread can. The worker reports these as
// unavailable so the page falls back; a main-thread read failure is then the typed answer.
const readFailures = new WeakSet<UnalteredError>();

/** True for an INPUT_UNREADABLE that came from a rejected file read (not a stall). */
export function isReadFailure(error: unknown): boolean {
  return error instanceof UnalteredError && readFailures.has(error);
}

/** WebCrypto needs one input buffer; fill it with bounded backend reads on every engine. */
export async function readCrossCheckInput(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
  if (blob.size > CROSS_CHECK_MAX) throw new UnalteredError('INPUT_INVALID', 'The cross-check input is too large.');
  const input = new Uint8Array(blob.size);
  for (let start = 0; start < blob.size; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, blob.size);
    // Opaque reads expose no intermediate progress; abort can stop our wait without imposing a chunk-fill deadline.
    let read: ArrayBuffer;
    try { read = await awaitAbortable(blob.slice(start, end).arrayBuffer(), signal); } catch (error) { throw readFailure(error); }
    if (signal?.aborted) throw new UnalteredError('ABORTED', 'Cancelled.');
    const bytes = new Uint8Array(read);
    if (bytes.length !== end - start) throw new UnalteredError('INPUT_INVALID', 'The file ended before its declared size.');
    input.set(bytes, start);
  }
  return input.buffer;
}

export interface ChunkSource {
  readonly size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
  stream?(): ReadableStream<Uint8Array>;
}

export interface StreamOptions {
  chunkSize?: number;
  signal?: AbortSignal | undefined;
  isCancelled?: () => boolean;
  onProgress?: (bytesDone: number) => void;
  /** Called between chunks so a main-thread fallback can yield to the event loop. */
  yieldFn?: () => Promise<void>;
  /** Stall timeout for one Blob slice read; tests shorten it. */
  stallMs?: number;
}

export interface StreamResult {
  digest: Uint8Array;
  hex: string;
  bytes: number;
}

/** Returns null if cancelled. */
export async function hashSource(src: ChunkSource, opts: StreamOptions = {}): Promise<StreamResult | null> {
  const chunk = opts.chunkSize ?? CHUNK_SIZE;
  if (!Number.isSafeInteger(chunk) || chunk <= 0 || !Number.isSafeInteger(src.size) || src.size < 0) {
    throw new UnalteredError('INPUT_INVALID', 'Invalid file or hashing chunk size.');
  }
  const isCancelled = (): boolean => opts.signal?.aborted === true || opts.isCancelled?.() === true;
  if (isCancelled()) return null;
  const stallMs = opts.stallMs ?? STALL_MS;
  if (!Number.isSafeInteger(stallMs) || stallMs <= 0) {
    throw new UnalteredError('INPUT_INVALID', 'Invalid hashing stall timeout.');
  }
  const h = sha256.create();
  let done = 0;
  let stalls = 0;
  let abandonedDataReaders = 0;
  let reported = 0;
  let reader: ReadableStreamBYOBReader | null = null;
  // True only while awaiting a file read, so failures from callbacks or hashing are not relabelled (no per-chunk cost).
  let reading = false;
  // WebKit may service a whole-Blob stream on the main thread even when requested by a worker.
  // Bound each backend read while retaining BYOB buffer reuse for large-file memory acceptance.
  const blob = typeof Blob !== 'undefined' && src instanceof Blob ? src : null;
  let streamEnd = blob ? Math.min(chunk, src.size) : src.size;
  if (src.stream) {
    try { reader = (blob ? blob.slice(0, streamEnd).stream() : src.stream()).getReader({ mode: 'byob' }); } catch { /* Older browsers require the slice fallback. */ }
  }
  // BYOB transfers the same backing store back on each read, avoiding hundreds of MB of obsolete
  // slice ArrayBuffers waiting for a browser GC cycle during a large-file hash.
  let buffer = reader ? new ArrayBuffer(chunk) : null;
  try {
    while (done < src.size) {
      if (isCancelled()) return null;
      const end = Math.min(done + chunk, reader ? streamEnd : src.size);
      let buf: Uint8Array;
      if (reader && buffer) {
        // Blob reads take whatever the backend has ready, so the stall timer measures time without any
        // bytes, not time to fill a whole chunk: a slow device that keeps delivering is never abandoned.
        reading = true;
        const read = blob
          ? await within(reader.read(new Uint8Array(buffer, 0, end - done)), stallMs, opts.signal)
          : await awaitAbortable(reader.read(new Uint8Array(buffer, 0, end - done), { min: end - done }), opts.signal);
        reading = false;
        if (isCancelled()) return null;
        if (read === STALLED) {
          // Nothing from this read reached the hash, so reopening [done, streamEnd) neither skips nor repeats bytes
          // (bytes from earlier partial reads were already hashed and counted in `done`).
          // The pending read keeps the old buffer; continue with a new one.
          abandonedDataReaders++;
          void abandon(reader).then(
            () => { abandonedDataReaders--; },
            () => { /* A failed cancellation does not establish that the backend released its buffer. */ },
          );
          reader = null;
          // Delivered bytes reset the silence counter, but cannot release a previous stalled backend's buffer.
          if (++stalls >= MAX_STALLS || abandonedDataReaders >= MAX_STALLS) throw unreadable();
          buffer = new ArrayBuffer(chunk);
          reader = blob!.slice(done, streamEnd).stream().getReader({ mode: 'byob' });
          continue;
        }
        if (read.done || !read.value?.byteLength || read.value.byteLength > end - done) {
          throw new UnalteredError('INPUT_INVALID', 'The file ended before its declared size.');
        }
        buf = read.value;
        buffer = read.value.buffer;
      } else {
        reading = true;
        const read = await awaitAbortable(src.slice(done, end).arrayBuffer(), opts.signal);
        reading = false;
        if (isCancelled()) return null;
        buf = new Uint8Array(read);
        if (buf.byteLength !== end - done) throw new UnalteredError('INPUT_INVALID', 'The file ended before its declared size.');
      }
      h.update(buf);
      done += buf.length;
      stalls = 0;
      // Partial reads can be much smaller than a chunk; report and yield once per chunk of progress.
      if (done - reported >= chunk || done === src.size) {
        reported = done;
        opts.onProgress?.(done);
        if (opts.yieldFn) await awaitAbortable(opts.yieldFn(), opts.signal);
      }
      if (isCancelled()) return null;
      if (blob && reader && done === streamEnd) {
        // Let the file backend finish the slice before reopening it. A separate tiny view
        // observes EOF without transferring/detaching the reusable hashing buffer.
        reading = true;
        const eof = await within(reader.read(new Uint8Array(1)), stallMs, opts.signal);
        reading = false;
        if (isCancelled()) return null;
        if (eof === STALLED) {
          // This read owns only the separate one-byte EOF view, not a transferred full hashing buffer.
          // The slice's bytes were all delivered and hashed; only the end-of-slice confirmation is missing.
          void abandon(reader).catch(() => {});
        } else {
          if (!eof.done || eof.value?.byteLength) {
            throw new UnalteredError('INPUT_INVALID', 'A file slice exceeded its declared size.');
          }
          reader.releaseLock();
        }
        reader = null;
        if (done < src.size) {
          streamEnd = Math.min(done + chunk, src.size);
          reader = blob.slice(done, streamEnd).stream().getReader({ mode: 'byob' });
        }
      }
    }
  } catch (error) {
    if (opts.signal?.aborted) return null;
    throw reading ? readFailure(error) : error;
  } finally {
    if (reader) {
      const cancelling = reader.cancel().catch(() => {});
      try { reader.releaseLock(); } catch { /* A pending read keeps the lock on older engines; the reader is dropped anyway. */ }
      await within(cancelling, CANCEL_SETTLE_MS);
    }
  }
  if (isCancelled()) return null;
  const digest = h.digest();
  return { digest, hex: toHex(digest), bytes: src.size };
}
