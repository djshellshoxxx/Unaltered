// Streaming SHA-256 over a Blob using @noble/hashes' incremental API (FR-1).
// Shared by the Web Worker and the main-thread fallback so both paths are identical.
import { sha256 } from '@noble/hashes/sha2.js';
import { toHex } from '../bytes';
import { UnalteredError } from '../errors';

export const CHUNK_SIZE = 4 * 1024 * 1024;

export interface ChunkSource {
  readonly size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
  stream?(): ReadableStream<Uint8Array>;
}

export interface StreamOptions {
  chunkSize?: number;
  isCancelled?: () => boolean;
  onProgress?: (bytesDone: number) => void;
  /** Called between chunks so a main-thread fallback can yield to the event loop. */
  yieldFn?: () => Promise<void>;
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
  const h = sha256.create();
  let done = 0;
  let reader: ReadableStreamBYOBReader | null = null;
  if (src.stream) {
    try { reader = src.stream().getReader({ mode: 'byob' }); } catch { /* Older browsers require the slice fallback. */ }
  }
  // BYOB transfers the same backing store back on each read, avoiding hundreds of MB of obsolete
  // slice ArrayBuffers waiting for a browser GC cycle during a large-file hash.
  let buffer = reader ? new ArrayBuffer(chunk) : null;
  try {
    while (done < src.size) {
      if (opts.isCancelled?.()) return null;
      const end = Math.min(done + chunk, src.size);
      let buf: Uint8Array;
      if (reader && buffer) {
        const read = await reader.read(new Uint8Array(buffer, 0, end - done), { min: end - done });
        if (read.done || !read.value?.byteLength || read.value.byteLength > end - done) {
          throw new UnalteredError('INPUT_INVALID', 'The file ended before its declared size.');
        }
        buf = read.value;
        buffer = read.value.buffer;
      } else {
        buf = new Uint8Array(await src.slice(done, end).arrayBuffer());
        if (buf.byteLength !== end - done) throw new UnalteredError('INPUT_INVALID', 'The file ended before its declared size.');
      }
      h.update(buf);
      done += buf.length;
      opts.onProgress?.(done);
      if (opts.yieldFn) await opts.yieldFn();
    }
  } finally {
    if (reader) {
      await reader.cancel();
      reader.releaseLock();
    }
  }
  const digest = h.digest();
  return { digest, hex: toHex(digest), bytes: src.size };
}
