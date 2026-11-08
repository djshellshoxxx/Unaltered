import type { ReceiptRec } from '../../ui/store';

export interface ReceiptDashboardSummary {
  saved: number;
  latestAddedUtc: string | null;
  /** Verification cannot be inferred from the locally saved fingerprint metadata. */
  verified: null;
  pending: null;
}
export function summarizeLocalReceipts(records: readonly ReceiptRec[]): ReceiptDashboardSummary {
  const validDates = records.map(r => r.createdAtUtc).filter(date => {
    const n = Date.parse(date);
    return Number.isFinite(n) && new Date(n).toISOString().replace('.000Z', 'Z') === date || new Date(n).toISOString() === date;
  });
  return {
    saved: records.length,
    latestAddedUtc: validDates.length ? validDates.sort().at(-1)! : null,
    verified: null,
    pending: null,
  };
}
