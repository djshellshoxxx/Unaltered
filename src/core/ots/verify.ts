// Verification (FR-7). No code path returns VERIFIED without (a) a matching file digest,
// (b) a replayed commitment that equals the Merkle root of a header agreed by >= minSources independent sources.
import { equalBytes, toHex } from '../bytes';
import { UnalteredError } from '../errors';
import { DEFAULT_EXPLORERS, DEFAULT_MIN_EXPLORERS } from '../net/allowlist';
import type { NetPolicy } from '../net/fetch';
import { esploraSource, headerQuorum, type HeaderSource } from './bitcoin';
import { collectAttestations, parseProof } from './codec';
import { LIMITS, type DetachedProof } from './types';

export type VerifyState = 'VERIFIED' | 'PENDING' | 'NO_MATCH_FILE' | 'INVALID_PROOF' | 'SOURCES_DISAGREE' | 'UNREACHABLE';

export interface VerifyConfig {
  sources: readonly HeaderSource[];
  minSources: number;
  signal?: AbortSignal | undefined;
}

export const defaultVerifyConfig = (net?: Partial<NetPolicy>): VerifyConfig => ({
  sources: DEFAULT_EXPLORERS.map((u) => esploraSource(u, net)),
  minSources: DEFAULT_MIN_EXPLORERS,
});

export interface VerifyReport {
  state: VerifyState;
  bitcoin?: { height: number; blockTimeUtc: string; sourcesAgreeing: string[] };
  detail: string;
  /** Calendars named in still-pending attestations. */
  pendingCalendars?: string[];
}

const iso = (unixSeconds: number): string => new Date(unixSeconds * 1000).toISOString().replace('.000Z', 'Z');

function classify(e: unknown): VerifyReport {
  if (e instanceof UnalteredError && e.code === 'ABORTED') throw e;
  const msg = e instanceof UnalteredError ? e.message : 'The receipt could not be read.';
  return { state: 'INVALID_PROOF', detail: msg };
}

export async function verifyProof(fileDigest: Uint8Array, proof: DetachedProof, cfg: VerifyConfig): Promise<VerifyReport> {
  if (!equalBytes(fileDigest, proof.digest)) {
    return { state: 'NO_MATCH_FILE', detail: 'The receipt is valid but was made for a different file. This file differs from the one that was stamped.' };
  }
  const atts = collectAttestations(proof.root);
  const bitcoin = atts.filter((a) => a.attestation.kind === 'bitcoin');
  const pending = [...new Set(atts.filter((a) => a.attestation.kind === 'pending').map((a) => (a.attestation as { uri: string }).uri))];
  if (atts.length === 0) return { state: 'INVALID_PROOF', detail: 'The receipt does not commit to anything.' };
  if (bitcoin.length === 0) {
    return { state: 'PENDING', detail: 'The file matches the receipt, but it is not anchored in Bitcoin yet. Pending is not proof yet.', pendingCalendars: pending };
  }

  const distinct = new Set(bitcoin.map((b) => `${(b.attestation as { height: number }).height}:${toHex(b.node.msg)}`));
  if (distinct.size > LIMITS.maxDistinctBitcoin) return { state: 'INVALID_PROOF', detail: 'The receipt contains an implausible number of Bitcoin attestations.' };
  let best: VerifyReport | null = null;
  const rank = (s: VerifyState): number => (s === 'VERIFIED' ? 4 : s === 'SOURCES_DISAGREE' ? 3 : s === 'UNREACHABLE' ? 2 : 1);
  // Check each distinct (height, commitment) once.
  const seen = new Set<string>();
  for (const { node, attestation } of bitcoin) {
    if (attestation.kind !== 'bitcoin') continue;
    const key = `${attestation.height}:${toHex(node.msg)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const q = await headerQuorum(cfg.sources, attestation.height, cfg.minSources, cfg.signal);
    let rep: VerifyReport;
    if (q.state === 'disagree') {
      rep = { state: 'SOURCES_DISAGREE', detail: 'The block explorers gave different answers. Do not trust this result; verify with your own Bitcoin node.' };
    } else if (q.state === 'unreachable') {
      rep = { state: 'UNREACHABLE', detail: `Could not reach enough independent block explorers (${q.got} answered, at least ${cfg.minSources} needed). Try again, or verify with your own Bitcoin node.` };
    } else if (!equalBytes(q.header.merkleRoot, node.msg)) {
      rep = { state: 'INVALID_PROOF', detail: 'The receipt does not lead to the Bitcoin block it claims.' };
    } else {
      rep = {
        state: 'VERIFIED',
        bitcoin: { height: attestation.height, blockTimeUtc: iso(q.header.time), sourcesAgreeing: q.agreeing },
        detail: 'The file matches the receipt and the receipt is anchored in the Bitcoin blockchain.',
      };
    }
    if (!best || rank(rep.state) > rank(best.state) || (rep.state === 'VERIFIED' && best.state === 'VERIFIED' && rep.bitcoin!.height < best.bitcoin!.height)) best = rep;
  }
  return best!;
}

export async function verify(fileDigest: Uint8Array, ots: Uint8Array, cfg: VerifyConfig): Promise<VerifyReport> {
  let proof: DetachedProof;
  try {
    proof = parseProof(ots);
  } catch (e) {
    return classify(e);
  }
  return verifyProof(fileDigest, proof, cfg);
}

