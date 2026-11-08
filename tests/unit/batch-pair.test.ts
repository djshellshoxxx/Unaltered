import { describe, expect, it } from 'vitest';
import { pairEvidenceFiles } from '../../src/core/reports/batch-pair';

describe('batch file/receipt pairing', () => {
  it('pairs exact original filenames with .ots receipts regardless of input order', () => {
    const result = pairEvidenceFiles(['a.txt', 'b.txt'], ['b.txt.ots', 'a.txt.ots']);
    expect(result).toEqual([{ fileName: 'a.txt', receiptName: 'a.txt.ots' }, { fileName: 'b.txt', receiptName: 'b.txt.ots' }]);
  });
  it('rejects missing and duplicate names instead of silently pairing wrong files', () => {
    expect(() => pairEvidenceFiles(['a.txt'], ['b.txt.ots'])).toThrow();
    expect(() => pairEvidenceFiles(['a.txt', 'a.txt'], ['a.txt.ots'])).toThrow();
    expect(() => pairEvidenceFiles(['a.txt'], ['a.txt.ots', 'a.txt.ots'])).toThrow();
  });
  it('enforces a bounded count and rejects unpaired extras', () => {
    expect(() => pairEvidenceFiles(['a'], ['a.ots', 'b.ots'])).toThrow();
    expect(() => pairEvidenceFiles(Array.from({ length: 51 }, (_, i) => String(i)), [])).toThrow();
  });
});
