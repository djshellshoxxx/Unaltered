import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { safeMessage, UnalteredError } from '../../src/core/errors';
import { hashBlob } from '../../src/core/hash/hasher';
import { CHUNK_SIZE, hashSource, readCrossCheckInput } from '../../src/core/hash/stream';

// A file that becomes unreadable after selection (deleted, modified, permission lost, device removed).
// Pinned Chromium rejects Blob stream reads with TypeError("network error") and Blob.arrayBuffer() with
// DOMException NotFoundError / NotReadableError (docs/evidence/hash-cancel-20261111.md). Each must reach the
// caller as the typed INPUT_UNREADABLE error with the generic message, never as the raw browser error.
const UNREADABLE = 'The browser stopped delivering the file. Try again, or copy the file to a local disk first.';
// Backend messages may name the file or its path; none of this may reach the caller.
const BACKEND_TEXT = 'backend failure for synthetic-private-name.bin';
const failures = {
  TypeError: (): Error => new TypeError(BACKEND_TEXT),
  NotReadableError: (): Error => new DOMException(BACKEND_TEXT, 'NotReadableError'),
  NotFoundError: (): Error => new DOMException(BACKEND_TEXT, 'NotFoundError'),
} as const;
type Failure = keyof typeof failures;
const kinds = Object.keys(failures) as Failure[];

function expectUnreadable(error: unknown): void {
  expect(error).toBeInstanceOf(UnalteredError);
  expect(error).toMatchObject({ code: 'INPUT_UNREADABLE', message: UNREADABLE });
  expect(safeMessage(error)).toBe(UNREADABLE);
  expect(JSON.stringify({ ...(error as object), message: (error as Error).message })).not.toContain('private-name');
}

/**
 * A Blob whose slices at or after `failAt` cannot be read. `via` selects the read API that fails:
 * the BYOB data read, the end-of-slice check, or slice.arrayBuffer() (fallback hashing and the cross-check).
 */
function breakingBlob(size: number, failAt: number, via: 'byob' | 'eof' | 'arrayBuffer', failure: Failure, byob = true) {
  const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 7 + 1) & 0xff);
  const blob = new Blob([bytes]);
  const slice = blob.slice.bind(blob);
  const ranges: number[][] = [];
  blob.stream = (): never => { throw new Error('unexpected whole-file stream'); };
  blob.slice = (start = 0, end = blob.size): Blob => {
    ranges.push([start, end]);
    const part = slice(start, end);
    const broken = start >= failAt;
    if (!byob) part.stream = (): never => { throw new Error('BYOB unavailable'); };
    else {
      const payload = bytes.subarray(start, end);
      let offset = 0;
      part.stream = () => new ReadableStream({
        type: 'bytes',
        pull(controller) {
          if (broken && via === 'byob') throw failures[failure]();
          if (offset === payload.length) {
            if (broken && via === 'eof') throw failures[failure]();
            controller.close();
            controller.byobRequest?.respond(0);
            return;
          }
          const request = controller.byobRequest!;
          const view = new Uint8Array(request.view!.buffer, request.view!.byteOffset, request.view!.byteLength);
          const length = Math.min(view.length, payload.length - offset);
          view.set(payload.subarray(offset, offset + length));
          offset += length;
          request.respond(length);
        },
      });
    }
    const read = part.arrayBuffer.bind(part);
    part.arrayBuffer = () => (broken && via === 'arrayBuffer' ? Promise.reject(failures[failure]()) : read());
    return part;
  };
  return { blob, bytes, ranges };
}

describe('a file that becomes unreadable mid-hash', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it.each(kinds)('maps a BYOB data read %s on a later slice to INPUT_UNREADABLE and stops reading', async (failure) => {
    const f = breakingBlob(7, 3, 'byob', failure);
    const progress: number[] = [];
    const error = await hashSource(f.blob, { chunkSize: 3, onProgress: (n) => progress.push(n) }).catch((e: unknown) => e);
    expectUnreadable(error);
    expect(progress).toEqual([3]);
    expect(f.ranges).toEqual([[0, 3], [3, 6]]);
  });

  it.each(kinds)('maps an end-of-slice read %s to INPUT_UNREADABLE', async (failure) => {
    const f = breakingBlob(7, 3, 'eof', failure);
    expectUnreadable(await hashSource(f.blob, { chunkSize: 3 }).catch((e: unknown) => e));
    expect(f.ranges).toEqual([[0, 3], [3, 6]]);
  });

  it.each(kinds)('maps a fallback slice arrayBuffer %s on a later chunk to INPUT_UNREADABLE', async (failure) => {
    const f = breakingBlob(7, 3, 'arrayBuffer', failure, false);
    const progress: number[] = [];
    expectUnreadable(await hashSource(f.blob, { chunkSize: 3, onProgress: (n) => progress.push(n) }).catch((e: unknown) => e));
    expect(progress).toEqual([3]);
  });

  it.each(kinds)('maps a non-Blob stream read %s to INPUT_UNREADABLE', async (failure) => {
    let pulls = 0;
    const src = {
      size: 6,
      slice: (): never => { throw new Error('unexpected slice allocation'); },
      stream: () => new ReadableStream({ type: 'bytes', pull(controller) {
        if (++pulls > 1) throw failures[failure]();
        const request = controller.byobRequest!;
        new Uint8Array(request.view!.buffer, request.view!.byteOffset, 3).fill(1);
        request.respond(3);
      } }),
    };
    expectUnreadable(await hashSource(src, { chunkSize: 3 }).catch((e: unknown) => e));
  });

  it.each(kinds)('maps a cross-check read %s on a later chunk to INPUT_UNREADABLE', async (failure) => {
    const f = breakingBlob(CHUNK_SIZE + 5, CHUNK_SIZE, 'arrayBuffer', failure);
    expectUnreadable(await readCrossCheckInput(f.blob).catch((e: unknown) => e));
    expect(f.ranges).toEqual([[0, CHUNK_SIZE], [CHUNK_SIZE, CHUNK_SIZE + 5]]);
  });

  it.each(kinds)('hashBlob on the main thread rejects a mid-hash %s with the typed error', async (failure) => {
    const f = breakingBlob(CHUNK_SIZE + 5, CHUNK_SIZE, 'byob', failure);
    expectUnreadable(await hashBlob(f.blob, { noWorker: true }).catch((e: unknown) => e));
  });

  it.each(kinds)('hashBlob rejects a cross-check %s after a complete hash with the typed error', async (failure) => {
    const f = breakingBlob(CHUNK_SIZE + 5, CHUNK_SIZE, 'arrayBuffer', failure);
    const digest = vi.spyOn(globalThis.crypto.subtle, 'digest');
    expectUnreadable(await hashBlob(f.blob, { noWorker: true }).catch((e: unknown) => e));
    expect(digest).not.toHaveBeenCalled();
  });

  it('keeps cancellation ahead of a read failure that arrives with the abort', async () => {
    const ac = new AbortController();
    const blob = new Blob(['abc']);
    const slice = blob.slice.bind(blob);
    let fail!: (error: unknown) => void;
    blob.slice = (start = 0, end = blob.size): Blob => {
      const part = slice(start, end);
      part.stream = () => new ReadableStream({ type: 'bytes', pull: () => new Promise<void>((_resolve, reject) => { fail = reject; }) });
      return part;
    };
    const pending = hashBlob(blob, { noWorker: true, signal: ac.signal }).catch((e: unknown) => e);
    await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
    ac.abort();
    fail(new TypeError('network error'));
    expect(await pending).toMatchObject({ code: 'ABORTED' });
  });

  it('does not relabel failures that are not file reads', async () => {
    const thrown = new TypeError('progress callback bug');
    await expect(hashSource(new Blob(['abcdef']), { chunkSize: 3, onProgress: () => { throw thrown; } })).rejects.toBe(thrown);
    // A short read is still the existing INPUT_INVALID, not INPUT_UNREADABLE.
    const short = { size: 3, slice: () => ({ arrayBuffer: async () => new ArrayBuffer(2) }) };
    await expect(hashSource(short)).rejects.toMatchObject({ code: 'INPUT_INVALID' });
  });
});

describe('the hash worker hands a rejected file read back to the page', () => {
  const replies: unknown[] = [];
  const workerScope = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    postMessage: (message: unknown): void => { replies.push(message); },
  };
  beforeAll(async () => {
    vi.stubGlobal('self', workerScope);
    try { await import('../../src/core/hash/hasher.worker'); } finally { vi.unstubAllGlobals(); }
  });

  async function run(blob: Blob): Promise<unknown> {
    replies.length = 0;
    workerScope.onmessage!(new MessageEvent('message', { data: { type: 'start', blob } }));
    await vi.waitFor(() => expect(replies.some((m) => ['done', 'failed', 'error', 'cancelled'].includes((m as { type: string }).type))).toBe(true));
    return replies.at(-1);
  }

  // A rejected read is not final inside a worker: WebKit's offline single-file build cannot read the Blob in its
  // worker but can on the main thread (CI webkit regression on 4a30914). The worker replies 'error' so the page falls
  // back; if the main thread cannot read either, it reports the typed INPUT_UNREADABLE (main-thread tests above).
  it.each(kinds)('a mid-hash %s makes the worker hand back to the page, never a final failure', async (failure) => {
    expect(await run(breakingBlob(CHUNK_SIZE + 5, CHUNK_SIZE, 'byob', failure).blob)).toEqual({ type: 'error' });
  });

  it.each(kinds)('a cross-check %s hands back to the page instead of reporting a skipped cross-check', async (failure) => {
    expect(await run(breakingBlob(CHUNK_SIZE + 5, CHUNK_SIZE, 'arrayBuffer', failure).blob)).toEqual({ type: 'error' });
  });

  it('still completes and cross-checks a readable file', async () => {
    const f = breakingBlob(7, Number.POSITIVE_INFINITY, 'byob', 'TypeError');
    const reply = await run(f.blob) as { type: string; digest: Uint8Array; cross: string };
    expect(reply.type).toBe('done');
    expect(Buffer.from(reply.digest).toString('hex')).toBe(createHash('sha256').update(f.bytes).digest('hex'));
    expect(reply.cross).toBe('ok');
  });
});
