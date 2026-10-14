// Streaming SHA-256 over a Blob using @noble/hashes' incremental API (FR-1).
// Shared by the Web Worker and the main-thread fallback so both paths are identical.
import { sha256 } from '@noble/hashes/sha2.js';
import { toHex } from '../bytes';

export const CHUNK_SIZE = 4 * 1024 * 1024;

export interface ChunkSource {
  readonly size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
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
  const h = sha256.create();
  let done = 0;
  while (done < src.size) {
    if (opts.isCancelled?.()) return null;
    const end = Math.min(done + chunk, src.size);
    const buf = new Uint8Array(await src.slice(done, end).arrayBuffer());
    h.update(buf);
    done = end;
    opts.onProgress?.(done);
    if (opts.yieldFn) await opts.yieldFn();
  }
  const digest = h.digest();
  return { digest, hex: toHex(digest), bytes: src.size };
}
