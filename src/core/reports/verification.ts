import type { VerifyReport } from '../ots/verify';

const HEX64 = /^[0-9a-f]{64}$/i;

/** Exported evidence summary, not a signed attestation or a substitute for the .ots receipt. */
export function createVerificationReportJson(fileSha256: string, report: VerifyReport): string {
  if (!HEX64.test(fileSha256)) throw new Error('Invalid SHA-256 digest');
  if (report.state === 'VERIFIED' && !report.bitcoin)
    throw new Error('Verified status requires Bitcoin evidence');
  const bitcoin = report.state === 'VERIFIED' ? report.bitcoin! : null;
  return JSON.stringify({
    format: 'UNALTERED-VERIFICATION-REPORT/1',
    fileSha256: fileSha256.toLowerCase(),
    status: report.state,
    bitcoin: bitcoin ? {
      height: bitcoin.height,
      blockTimeUtc: bitcoin.blockTimeUtc,
      sourcesAgreeing: [...bitcoin.sourcesAgreeing],
    } : null,
    pendingCalendars: report.pendingCalendars ?? [],
    detail: report.detail,
    warning: 'This report is not a cryptographic signature and does not replace the original file or .ots receipt. Pending or inconclusive results are not Bitcoin confirmation. Independently reverify the receipt.',
  }, null, 2) + '\n';
}
