// Block header sources and quorum logic (FR-7 step 5, ADR-006).
// We fetch the raw 80-byte header from each explorer and read the Merkle root and time from the bytes
// ourselves, after checking that the header hashes to the block hash the explorer claimed.
import { sha256 } from '@noble/hashes/sha2.js';
import { equalBytes, fromHex, reversed, toHex } from '../bytes';
import { UnalteredError } from '../errors';
import { netFetch, type NetPolicy } from '../net/fetch';

export interface BlockHeader {
  raw: Uint8Array;
  /** Block hash in display (big-endian) hex. */
  hashHex: string;
  /** Merkle root in internal byte order: the value OpenTimestamps commits to. */
  merkleRoot: Uint8Array;
  /** Unix seconds as set by the miner. */
  time: number;
}

export interface HeaderSource {
  /** Distinct identity for quorum counting (the host). */
  readonly id: string;
  fetchHeader(height: number, signal?: AbortSignal): Promise<Uint8Array>;
}

export function parseHeader(raw: Uint8Array): BlockHeader {
  if (raw.length !== 80) throw new UnalteredError('SOURCE_INVALID', 'A block header had the wrong size.');
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const hash = sha256(sha256(raw));
  return {
    raw: raw.slice(),
    hashHex: toHex(reversed(hash)),
    merkleRoot: raw.slice(36, 68),
    time: dv.getUint32(68, true),
  };
}

const HEX64 = /^[0-9a-f]{64}$/;
const HEX160 = /^[0-9a-f]{160}$/;

/** Esplora-compatible API (mempool.space, blockstream.info). */
export function esploraSource(baseUrl: string, net?: Partial<NetPolicy>): HeaderSource {
  const base = baseUrl.replace(/\/+$/, '');
  const id = new URL(base).host;
  const text = async (path: string, signal?: AbortSignal): Promise<string> => {
    const res = await netFetch(`${base}${path}`, { signal }, { maxBytes: 4096, ...net });
    if (res.status !== 200) throw new UnalteredError('NET_HTTP', `A block explorer answered with status ${res.status}.`);
    return new TextDecoder().decode(res.bytes).trim().toLowerCase();
  };
  return {
    id,
    async fetchHeader(height, signal) {
      if (!Number.isSafeInteger(height) || height < 0) throw new UnalteredError('INPUT_INVALID', 'Invalid block height.');
      const hash = await text(`/api/block-height/${height}`, signal);
      if (!HEX64.test(hash)) throw new UnalteredError('SOURCE_INVALID', 'A block explorer sent an invalid block hash.');
      const hdr = await text(`/api/block/${hash}/header`, signal);
      if (!HEX160.test(hdr)) throw new UnalteredError('SOURCE_INVALID', 'A block explorer sent an invalid block header.');
      const raw = fromHex(hdr);
      if (parseHeader(raw).hashHex !== hash) throw new UnalteredError('SOURCE_INVALID', 'A block explorer sent a header that does not match its block hash.');
      return raw;
    },
  };
}

export type QuorumOutcome =
  | { state: 'agreed'; header: BlockHeader; agreeing: string[] }
  | { state: 'disagree'; groups: { ids: string[]; hashHex: string }[] }
  | { state: 'unreachable'; got: number; failures: string[] };

/** Ask every source; require `minSources` distinct sources, all of which must return the identical header. */
export async function headerQuorum(
  sources: readonly HeaderSource[],
  height: number,
  minSources: number,
  signal?: AbortSignal,
): Promise<QuorumOutcome> {
  const unique = new Map<string, HeaderSource>();
  for (const s of sources) if (!unique.has(s.id)) unique.set(s.id, s);
  const settled = await Promise.allSettled([...unique.values()].map(async (s) => ({ id: s.id, raw: await s.fetchHeader(height, signal) })));
  const ok: { id: string; raw: Uint8Array }[] = [];
  const failures: string[] = [];
  for (const [i, r] of settled.entries()) {
    if (r.status === 'fulfilled') ok.push(r.value);
    else {
      if (r.reason instanceof UnalteredError && r.reason.code === 'ABORTED') throw r.reason;
      failures.push([...unique.keys()][i]!);
    }
  }
  const groups: { raw: Uint8Array; ids: string[] }[] = [];
  for (const o of ok) {
    const g = groups.find((x) => equalBytes(x.raw, o.raw));
    if (g) g.ids.push(o.id);
    else groups.push({ raw: o.raw, ids: [o.id] });
  }
  if (groups.length > 1) return { state: 'disagree', groups: groups.map((g) => ({ ids: g.ids, hashHex: parseHeader(g.raw).hashHex })) };
  if (ok.length < Math.max(1, minSources) || groups.length === 0) return { state: 'unreachable', got: ok.length, failures };
  return { state: 'agreed', header: parseHeader(groups[0]!.raw), agreeing: groups[0]!.ids };
}
