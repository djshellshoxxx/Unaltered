import { describe, expect, it } from 'vitest';
import { netFetch } from '../../src/core/net/fetch';

// A reply refused for its size must release the connection at once. Left unread, a real fetch keeps the socket open
// until the timeout aborts it (15 s by default), which also keeps the CLI process alive after it has printed a result.
describe('core/net reply bodies', () => {
  const pending = (onCancel: () => void): ReadableStream<Uint8Array> =>
    new ReadableStream<Uint8Array>({ start: (c) => c.enqueue(new Uint8Array(1)), cancel: onCancel });

  it('cancels the body of a reply whose declared length is over the cap', async () => {
    let cancelled = 0;
    const f = (async () => new Response(pending(() => void cancelled++), { headers: { 'content-length': '999999' } })) as typeof fetch;
    await expect(netFetch('https://mempool.space/a', {}, { fetchImpl: f })).rejects.toMatchObject({ code: 'NET_TOO_LARGE' });
    expect(cancelled).toBe(1);
  });

  it('cancels the body of a reply that streams past the cap', async () => {
    let cancelled = 0;
    const body = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(new Uint8Array(64 * 1024)), cancel: () => void cancelled++ });
    const f = (async () => new Response(body)) as typeof fetch;
    await expect(netFetch('https://mempool.space/a', {}, { fetchImpl: f })).rejects.toMatchObject({ code: 'NET_TOO_LARGE' });
    expect(cancelled).toBe(1);
  });
});
