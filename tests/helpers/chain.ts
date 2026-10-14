// Test doubles: synthetic block headers, fake explorers, fake calendars. No network, no real data.
import { sha256 } from '@noble/hashes/sha2.js';
import { fromHex, reversed, toHex } from '../../src/core/bytes';
import { parseHeader } from '../../src/core/ots/bitcoin';
import { serializeTree } from '../../src/core/ots/codec';
import type { TsNode } from '../../src/core/ots/types';

export function makeHeader(merkleRoot: Uint8Array, time = 1_700_000_000, salt = 0): { raw: Uint8Array; hashHex: string } {
  const raw = new Uint8Array(80);
  const dv = new DataView(raw.buffer);
  dv.setUint32(0, 0x20000000, true);
  raw.set(merkleRoot, 36);
  dv.setUint32(68, time, true);
  dv.setUint32(72, 0x1d00ffff, true);
  dv.setUint32(76, salt, true);
  return { raw, hashHex: parseHeader(raw).hashHex };
}

export function dsha(raw: Uint8Array): string {
  return toHex(reversed(sha256(sha256(raw))));
}

export type Handler = (url: URL, init: RequestInit) => Response | Promise<Response> | null;

/** fetch implementation that routes by URL. Unknown routes throw (so a stray request fails the test). */
export function routerFetch(...handlers: Handler[]): typeof fetch {
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    for (const h of handlers) {
      const r = await h(url, init);
      if (r) return r;
    }
    throw new Error(`unexpected request ${url.href}`);
  }) as typeof fetch;
}

export const text = (s: string, status = 200): Response => new Response(s, { status });
export const bin = (b: Uint8Array, status = 200): Response => new Response(b as BodyInit, { status });

/** Fake esplora explorer serving the given headers by height. */
export function explorer(host: string, headers: Record<number, Uint8Array>): Handler {
  return (url) => {
    if (url.host !== host) return null;
    let m = /^\/api\/block-height\/(\d+)$/.exec(url.pathname);
    if (m) {
      const h = headers[Number(m[1])];
      return h ? text(parseHeader(h).hashHex) : text('Block not found', 404);
    }
    m = /^\/api\/block\/([0-9a-f]{64})\/header$/.exec(url.pathname);
    if (m) {
      for (const h of Object.values(headers)) if (parseHeader(h).hashHex === m[1]) return text(toHex(h));
      return text('Block not found', 404);
    }
    return null;
  };
}

export const TEST_POLICY = (fetchImpl: typeof fetch) => ({ fetchImpl });

/** Calendar that answers POST /digest with the supplied tree builder, and GET /timestamp/<hex> from a map. */
export function calendar(
  host: string,
  opts: {
    onDigest?: (digest: Uint8Array) => TsNode;
    upgrades?: Map<string, TsNode>;
    status?: number;
  } = {},
): Handler {
  return (url, init) => {
    if (url.host !== host) return null;
    if (url.pathname === '/digest' && init.method === 'POST') {
      if (opts.status && opts.status !== 200) return text('nope', opts.status);
      const body = init.body as Uint8Array;
      const node = opts.onDigest ? opts.onDigest(body) : { msg: body, attestations: [{ kind: 'pending' as const, uri: `https://${host}` }], children: [] };
      return bin(serializeTree(node));
    }
    const m = /^\/timestamp\/([0-9a-f]+)$/.exec(url.pathname);
    if (m) {
      const n = opts.upgrades?.get(m[1]!);
      return n ? bin(serializeTree(n)) : text('Pending confirmation in Bitcoin blockchain', 404);
    }
    return null;
  };
}

export { fromHex };
