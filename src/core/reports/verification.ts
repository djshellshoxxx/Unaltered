import type { VerifyReport, VerifyState } from '../ots/verify';

const HEX64 = /^[0-9a-f]{64}$/i;

// These core verdicts use file-specific wording when a file was hashed.
const linkDetails: Partial<Record<VerifyState, string>> = {
  VERIFIED: 'The supplied fingerprint matches the receipt and the receipt is anchored in Bitcoin.',
  PENDING: 'The supplied fingerprint matches the receipt. It is not anchored in Bitcoin yet.',
  NO_MATCH_FILE: 'The supplied fingerprint differs from the fingerprint in the receipt.',
};

/** Exported evidence summary, not a signed attestation or a substitute for the .ots receipt. */
export function createVerificationReportJson(fileSha256: string, report: VerifyReport, digestSource: 'file' | 'share-link' = 'file'): string {
  if (!HEX64.test(fileSha256)) throw new Error('Invalid SHA-256 digest');
  if (report.state === 'VERIFIED' && !report.bitcoin)
    throw new Error('Verified status requires Bitcoin evidence');
  const bitcoin = report.state === 'VERIFIED' ? report.bitcoin! : null;
  return JSON.stringify({
    format: 'UNALTERED-VERIFICATION-REPORT/1',
    fileSha256: fileSha256.toLowerCase(),
    digestSource,
    status: report.state,
    bitcoin: bitcoin ? {
      height: bitcoin.height,
      blockHash: bitcoin.blockHash,
      blockTimeUtc: bitcoin.blockTimeUtc,
      sourcesAgreeing: [...bitcoin.sourcesAgreeing],
    } : null,
    pendingCalendars: report.pendingCalendars ?? [],
    detail: digestSource === 'share-link' ? `${linkDetails[report.state] ?? report.detail} No file was checked.` : report.detail,
    warning: 'This report is not a cryptographic signature and does not replace the original file or .ots receipt. Pending or inconclusive results are not Bitcoin confirmation. Independently reverify the receipt.',
  }, null, 2) + '\n';
}
