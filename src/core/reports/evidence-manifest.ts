/** Offline manifest for a future evidence ZIP. No proof verification is implied. */
export interface EvidenceEntry { size: number; sha256: string }
export interface EvidenceManifest {
  format: 'UNALTERED-EVIDENCE-BUNDLE/1';
  original: EvidenceEntry;
  receipt: EvidenceEntry;
  verification: 'NOT_PERFORMED';
  note: string;
}
const digest = async (bytes: Uint8Array): Promise<EvidenceEntry> => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
  return { size: bytes.byteLength, sha256: Array.from(hash, b => b.toString(16).padStart(2, '0')).join('') };
};
export async function createEvidenceManifest(original: Uint8Array, receipt: Uint8Array): Promise<EvidenceManifest> {
  if (!original.byteLength || !receipt.byteLength) throw new Error('Evidence file and receipt must not be empty');
  return {
    format: 'UNALTERED-EVIDENCE-BUNDLE/1',
    original: await digest(original),
    receipt: await digest(receipt),
    verification: 'NOT_PERFORMED',
    note: 'Checksums identify exact bytes but do not establish a Bitcoin timestamp. Verify the original file and standard .ots receipt independently.',
  };
}
