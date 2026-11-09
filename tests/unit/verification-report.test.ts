import { describe, expect, it } from 'vitest';
import { createVerificationReportJson } from '../../src/core/reports/verification';

const digest = 'a'.repeat(64);
describe('portable verification report', () => {
  it('preserves the pending state without implying Bitcoin confirmation', () => {
    const report = JSON.parse(createVerificationReportJson(digest, { state: 'PENDING', detail: 'Not confirmed', pendingCalendars: ['https://alice.btc.calendar.opentimestamps.org'] }));
    expect(report.format).toBe('UNALTERED-VERIFICATION-REPORT/1');
    expect(report.fileSha256).toBe(digest);
    expect(report.status).toBe('PENDING');
    expect(report.bitcoin).toBeNull();
    expect(report.warning).toContain('not');
  });
  it('includes independently checkable block evidence only for verified results', () => {
    const report = JSON.parse(createVerificationReportJson(digest, { state: 'VERIFIED', detail: 'Confirmed', bitcoin: { height: 100, blockHash: 'b'.repeat(64), blockTimeUtc: '2020-01-01T00:00:00Z', sourcesAgreeing: ['mempool.space', 'blockstream.info'] } }));
    expect(report.bitcoin.height).toBe(100);
    expect(report.bitcoin.sourcesAgreeing).toHaveLength(2);
  });
  it('rejects invalid file digests', () => {
    expect(() => createVerificationReportJson('not-a-hash', { state: 'PENDING', detail: 'pending' })).toThrow();
  });
});
