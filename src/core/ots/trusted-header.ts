// Offline evidence comparison, distinct from explorer quorum and full-node/chain verification.
import { equalBytes, toHex } from '../bytes';
import { UnalteredError, safeMessage } from '../errors';
import { parseHeader, type BlockHeader } from './bitcoin';
import { collectAttestations, parseProof } from './codec';
import { LIMITS } from './types';

export interface TrustedHeaderEvidence {
  /** Height-to-hash mapping from the user's trusted source; the header does not encode its height. */
  readonly height: number;
  readonly hashHex: string;
  readonly raw: Uint8Array;
}
export type TrustedHeaderState = 'MATCHED_TRUSTED_HEADER' | 'PENDING' | 'NO_MATCH_FILE'
  | 'INVALID_PROOF' | 'INVALID_HEADER' | 'MISSING_HEADER' | 'NO_MATCH_HEADER';
export interface TrustedHeaderReport {
  state: TrustedHeaderState;
  trust: 'USER_SUPPLIED_HEADER';
  detail: string;
  bitcoin?: { height: number; hashHex: string; blockTimeUtc: string };
}

/** Validate supplied identity before potentially hashing a large local file. */
export function checkTrustedHeader(evidence: TrustedHeaderEvidence): BlockHeader {
  if (!evidence || !Number.isInteger(evidence.height) || evidence.height < 0 || evidence.height > 0xffff_ffff
    || typeof evidence.hashHex !== 'string' || !/^[0-9a-fA-F]{64}$/.test(evidence.hashHex)
    || !(evidence.raw instanceof Uint8Array) || evidence.raw.length !== 80) {
    throw new UnalteredError('SOURCE_INVALID', 'Invalid trusted header evidence.');
  }
  // Hash and extract fields from the same private 80-byte snapshot, including for shared-buffer callers.
  const header = parseHeader(evidence.raw.slice());
  if (header.hashHex !== evidence.hashHex.toLowerCase()) {
    throw new UnalteredError('SOURCE_INVALID', 'The supplied header does not match its expected block hash.');
  }
  return header;
}

/** Replay standard .ots operations without network access or a VERIFIED/L2 claim. */
export function verifyWithTrustedHeader(fileDigest: Uint8Array, ots: Uint8Array, evidence: TrustedHeaderEvidence): TrustedHeaderReport {
  const report = (state: TrustedHeaderState, detail: string): TrustedHeaderReport => ({ state, detail, trust: 'USER_SUPPLIED_HEADER' });
  let header: BlockHeader;
  try { header = checkTrustedHeader(evidence); }
  catch (error) { return report('INVALID_HEADER', safeMessage(error)); }
  let proof;
  try { proof = parseProof(ots); }
  catch (error) { return report('INVALID_PROOF', safeMessage(error)); }
  if (!equalBytes(fileDigest, proof.digest)) return report('NO_MATCH_FILE', 'The file differs from the receipt.');
  const atts = collectAttestations(proof.root);
  const bitcoin = atts.filter(({ attestation }) => attestation.kind === 'bitcoin');
  if (!bitcoin.length) return report('PENDING', 'The receipt has no Bitcoin attestation. Pending is not proof yet.');
  const distinct = new Set(bitcoin.map(({ node, attestation }) =>
    `${attestation.kind === 'bitcoin' ? attestation.height : ''}:${toHex(node.msg)}`));
  if (distinct.size > LIMITS.maxDistinctBitcoin) return report('INVALID_PROOF', 'Too many distinct Bitcoin attestations.');
  const matching = bitcoin.filter(({ attestation }) => attestation.kind === 'bitcoin' && attestation.height === evidence.height);
  if (!matching.length) return report('MISSING_HEADER', 'No Bitcoin attestation names the supplied header height.');
  if (!matching.some(({ node }) => equalBytes(node.msg, header.merkleRoot))) {
    return report('NO_MATCH_HEADER', 'The receipt does not lead to the supplied header Merkle root.');
  }
  return {
    ...report('MATCHED_TRUSTED_HEADER', 'The file and receipt match the supplied header. Chain membership and height remain trusted inputs; Bitcoin consensus is not checked.'),
    bitcoin: { height: evidence.height, hashHex: header.hashHex,
      blockTimeUtc: new Date(header.time * 1000).toISOString().replace('.000Z', 'Z') },
  };
}
