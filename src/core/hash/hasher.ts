// STUB: implemented by the hashing workstream (FR-1). Signature is normative (SPEC 5.2).
export interface HashResult { digest: Uint8Array; hex: string; bytes: number }
export interface HashOptions { signal?: AbortSignal; onProgress?: (bytesDone: number) => void }

export function hashBlob(_blob: Blob, _opts?: HashOptions): Promise<HashResult> {
  throw new Error('not implemented');
}
