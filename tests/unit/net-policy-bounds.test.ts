import { describe, expect, it, vi } from 'vitest';
import { netFetch } from '../../src/core/net/fetch';

const URL = 'https://mempool.space/api/block-height/0';

describe('network policy bounds fail closed before transport', () => {
  for (const maxBytes of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, undefined]) {
    it(`rejects invalid response cap ${String(maxBytes)} without a request`, async () => {
      const fetchImpl = vi.fn(async () => new Response(new Uint8Array(32)));
      await expect(netFetch(URL, {}, { maxBytes: maxBytes as number, fetchImpl }))
        .rejects.toMatchObject({ code: 'INPUT_INVALID' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }

  for (const timeoutMs of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0.5, 0x8000_0000, 0x1_0000_0000, undefined]) {
    it(`rejects invalid timeout ${String(timeoutMs)} without a request`, async () => {
      const fetchImpl = vi.fn(async () => new Response('ok'));
      await expect(netFetch(URL, {}, { timeoutMs: timeoutMs as number, fetchImpl }))
        .rejects.toMatchObject({ code: 'INPUT_INVALID' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  }

  it('accepts the largest delay supported by signed 32-bit browser and Node timers', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    await expect(netFetch(URL, {}, { timeoutMs: 0x7fff_ffff, fetchImpl })).resolves.toMatchObject({ status: 200 });
  });

  it('permits an explicit zero-byte budget for an empty response', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(netFetch(URL, {}, { maxBytes: 0, fetchImpl })).resolves.toMatchObject({ status: 204, bytes: new Uint8Array() });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('still rejects a non-empty stream with a zero-byte budget', async () => {
    const fetchImpl = vi.fn(async () => new Response(Uint8Array.of(1)));
    await expect(netFetch(URL, {}, { maxBytes: 0, fetchImpl })).rejects.toMatchObject({ code: 'NET_TOO_LARGE' });
  });
});
