// STUB: public API of the OpenTimestamps workstream (FR-4..FR-8, FR-10). Signatures are normative.
import type { StampConfig, VerifyConfig } from '../config';

export interface CalendarResult { url: string; ok: boolean; error?: string }
export interface StampResult { ots: Uint8Array; calendars: CalendarResult[] }
export interface BatchStampResult { ots: Uint8Array[]; calendars: CalendarResult[] }

export type ProofStatus = 'pending' | 'bitcoin-confirmed';

export type VerifyState =
  | 'VERIFIED' | 'PENDING' | 'NO_MATCH_FILE'
  | 'INVALID_PROOF' | 'SOURCES_DISAGREE' | 'UNREACHABLE';

export interface VerifyReport {
  state: VerifyState;
  bitcoin?: { height: number; blockTimeUtc: string; sourcesAgreeing: string[] };
  detail: string;
}

export interface ProofSummary {
  /** Lowercase hex of the file digest the proof starts from. */
  fileDigestHex: string;
  status: ProofStatus;
  /** Calendar URIs from pending attestations (may include non-allowlisted ones). */
  pendingCalendars: string[];
  /** Pending calendar URIs that are NOT on the allowlist (never contacted). */
  unknownCalendars: string[];
  bitcoinHeights: number[];
}

/** Parse and summarise a receipt. Throws UnalteredError('OTS_MALFORMED'|'OTS_UNSUPPORTED'|'OTS_TOO_LARGE'). */
export function inspect(_ots: Uint8Array): ProofSummary { throw new Error('not implemented'); }

export function stamp(_digest: Uint8Array, _cfg: StampConfig): Promise<StampResult> { throw new Error('not implemented'); }

/** FR-10: one calendar submission for many files; one receipt per input digest, same order. */
export function stampBatch(_digests: Uint8Array[], _cfg: StampConfig): Promise<BatchStampResult> { throw new Error('not implemented'); }

export function upgrade(_ots: Uint8Array, _cfg: StampConfig):
  Promise<{ ots: Uint8Array; changed: boolean; status: ProofStatus }> { throw new Error('not implemented'); }

export function verify(_fileDigest: Uint8Array, _ots: Uint8Array, _cfg: VerifyConfig): Promise<VerifyReport> {
  throw new Error('not implemented');
}
