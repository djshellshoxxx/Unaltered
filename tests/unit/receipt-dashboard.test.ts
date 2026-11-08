import { describe, expect, it } from 'vitest';
import { summarizeLocalReceipts } from '../../src/core/reports/receipt-dashboard';

describe('local receipt dashboard', () => {
  it('counts saved metadata without inventing verification states', () => {
    const result = summarizeLocalReceipts([
      { digestHex: 'a'.repeat(64), createdAtUtc: '2026-11-01T00:00:00Z', label: 'one' },
      { digestHex: 'b'.repeat(64), createdAtUtc: '2026-11-02T00:00:00Z', label: 'two' },
    ]);
    expect(result).toEqual({ saved: 2, latestAddedUtc: '2026-11-02T00:00:00Z', verified: null, pending: null });
  });
  it('does not treat malformed dates as verified or recent', () => {
    const result = summarizeLocalReceipts([{ digestHex: 'a'.repeat(64), createdAtUtc: 'garbage', label: '' }]);
    expect(result.latestAddedUtc).toBeNull();
    expect(result.verified).toBeNull();
  });
});
